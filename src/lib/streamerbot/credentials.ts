import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { creators, creatorModules, streamerbotCredentials } from "@/lib/db/schema";
import { env, isProduction } from "@/lib/env";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { listDemoCreatorTenants } from "@/lib/creators/demo-store";
import { defaultCreatorTenant } from "@/lib/creators/tenant";
import { encryptCredentialSecret } from "@/lib/streamerbot/credential-crypto";

export type CredentialRecord = typeof streamerbotCredentials.$inferSelect;
export type CredentialSummary = Pick<CredentialRecord, "id" | "status" | "createdAt" | "retiringUntil" | "revokedAt" | "lastUsedAt">;
export class CredentialOperationError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

function database() {
  const db = getDb();
  if (!db) throw new CredentialOperationError(503, "Credenciais exigem um banco configurado.");
  return db;
}

export function credentialIsUsable(record: CredentialRecord, now = Date.now()) {
  return !record.revokedAt && (record.status === "active" ||
    (record.status === "retiring" && record.retiringUntil !== null && record.retiringUntil.getTime() > now));
}

export async function findStreamerbotCredential(id: string) {
  const [row] = await database().select().from(streamerbotCredentials).where(eq(streamerbotCredentials.id, id)).limit(1);
  return row ?? null;
}

/** Strict policy by verified ID; never resolve integration authority from host/slug. */
async function creatorModuleIsEnabled(creatorId: string, moduleKey: string) {
  const db = getDb();
  if (!db) {
    if (isProduction) throw new Error("integration_database_unavailable");
    const tenant = listDemoCreatorTenants().find((entry) => entry.creator.id === creatorId)
      ?? (creatorId === DEFAULT_CREATOR_ID ? defaultCreatorTenant : null);
    return tenant?.creator.status === "active" && tenant.modules.some((entry) => entry.moduleKey === moduleKey && entry.status === "installed");
  }
  const [row] = await db.select({ creatorStatus: creators.status, moduleStatus: creatorModules.status })
    .from(creators).innerJoin(creatorModules, and(eq(creatorModules.creatorId, creators.id), eq(creatorModules.moduleKey, moduleKey)))
    .where(eq(creators.id, creatorId)).limit(1);
  return row?.creatorStatus === "active" && row.moduleStatus === "installed";
}

export const streamerbotCreatorIsEnabled = (creatorId: string) => creatorModuleIsEnabled(creatorId, "streamerbot");
export const streamerbotQuoteModuleIsEnabled = (creatorId: string) => creatorModuleIsEnabled(creatorId, "quotes");

export async function markStreamerbotCredentialUsed(id: string, now: Date) {
  await database().update(streamerbotCredentials).set({ lastUsedAt: now }).where(eq(streamerbotCredentials.id, id));
}

const publicColumns = {
  id: streamerbotCredentials.id, status: streamerbotCredentials.status, createdAt: streamerbotCredentials.createdAt,
  retiringUntil: streamerbotCredentials.retiringUntil, revokedAt: streamerbotCredentials.revokedAt, lastUsedAt: streamerbotCredentials.lastUsedAt,
};

export async function listStreamerbotCredentials(creatorId: string): Promise<CredentialSummary[]> {
  return database().select(publicColumns).from(streamerbotCredentials)
    .where(eq(streamerbotCredentials.creatorId, creatorId)).orderBy(desc(streamerbotCredentials.createdAt));
}

export async function issueStreamerbotCredential(creatorId: string, rotateId?: string) {
  const id = `sbc_${randomBytes(16).toString("hex")}`;
  const secret = randomBytes(32).toString("base64url");
  // Encrypt before any write; unavailable master keys can never produce plaintext records.
  const encryptedSecret = encryptCredentialSecret(secret, id, creatorId, env.STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY);
  const now = new Date();
  const retiringUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await database().transaction(async (tx) => {
    // Serialize provisioning/rotation for this creator, including concurrent first issuance.
    const [creator] = await tx.select().from(creators).where(eq(creators.id, creatorId)).for("update");
    if (!creator) throw new CredentialOperationError(404, "Streamer não encontrado.");
    const [module] = await tx.select().from(creatorModules).where(and(eq(creatorModules.creatorId, creatorId), eq(creatorModules.moduleKey, "streamerbot")));
    if (creator.status !== "active" || module?.status !== "installed") throw new CredentialOperationError(409, "Ative o streamer e a integração com Streamer.bot antes de criar uma credencial.");
    const active = await tx.select({ id: streamerbotCredentials.id }).from(streamerbotCredentials)
      .where(and(eq(streamerbotCredentials.creatorId, creatorId), eq(streamerbotCredentials.status, "active")));
    if (rotateId ? active.length !== 1 || active[0].id !== rotateId : active.length > 0) {
      throw new CredentialOperationError(409, "As credenciais mudaram. Atualize a lista e tente novamente.");
    }
    if (rotateId) await tx.update(streamerbotCredentials).set({ status: "retiring", retiringUntil })
      .where(and(eq(streamerbotCredentials.id, rotateId), eq(streamerbotCredentials.creatorId, creatorId)));
    await tx.insert(streamerbotCredentials).values({ id, creatorId, encryptedSecret, status: "active", createdAt: now });
  });
  return { id, secret, creatorId, retiringUntil: rotateId ? retiringUntil.toISOString() : null };
}

export async function revokeStreamerbotCredential(creatorId: string, id: string) {
  return database().transaction(async (tx) => {
    // Same lock/order as rotation so revocation cannot be lost to a concurrent rotation.
    await tx.select({ id: creators.id }).from(creators).where(eq(creators.id, creatorId)).for("update");
    const [row] = await tx.update(streamerbotCredentials).set({ status: "revoked", revokedAt: new Date() })
      .where(and(eq(streamerbotCredentials.creatorId, creatorId), eq(streamerbotCredentials.id, id))).returning(publicColumns);
    if (!row) throw new CredentialOperationError(404, "Credencial não encontrada.");
    return row;
  });
}
