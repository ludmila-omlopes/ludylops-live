import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creatorModules, creators } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import { currencySettingsSchema, getCurrencyLabel } from "./currency";

export class CurrencyAccessError extends Error {
  constructor() { super("Moeda indisponível para esta comunidade."); }
}

function assertIdentity(ownerUserId: string, creatorId: string) {
  // Legacy Ludylops labels still belong to its existing economy and integration.
  if (!ownerUserId || !creatorId || creatorId === DEFAULT_CREATOR_ID) throw new CurrencyAccessError();
}

function demoModule(ownerUserId: string, creatorId: string) {
  const tenant = listDemoCreatorTenants().find((entry) => entry.creator.id === creatorId
    && entry.creator.ownerUserId === ownerUserId && entry.creator.status === "active");
  const pointsModule = tenant?.modules.find((entry) => entry.moduleKey === "points"
    && (entry.status === "installed" || entry.status === "disabled"));
  if (!pointsModule) throw new CurrencyAccessError();
  return pointsModule;
}

/** ownerUserId must come from the authenticated session, never the request body. */
export async function getOwnedCurrency(ownerUserId: string, creatorId: string) {
  assertIdentity(ownerUserId, creatorId);
  if (isDemoMode) return { currencyLabel: getCurrencyLabel(demoModule(ownerUserId, creatorId).configJson) };
  const db = getDb();
  if (!db) throw new Error("currency_storage_unavailable");
  const [row] = await db.select({ configJson: creatorModules.configJson })
    .from(creators).innerJoin(creatorModules, eq(creatorModules.creatorId, creators.id))
    .where(and(eq(creators.id, creatorId), eq(creators.ownerUserId, ownerUserId),
      eq(creators.status, "active"), eq(creatorModules.moduleKey, "points"),
      inArray(creatorModules.status, ["installed", "disabled"]))).limit(1);
  if (!row) throw new CurrencyAccessError();
  return { currencyLabel: getCurrencyLabel(row.configJson as Record<string, unknown>) };
}

export async function updateOwnedCurrency(ownerUserId: string, creatorId: string, input: unknown) {
  assertIdentity(ownerUserId, creatorId);
  const { currencyLabel } = currencySettingsSchema.parse(input);
  if (isDemoMode) {
    const pointsModule = demoModule(ownerUserId, creatorId);
    pointsModule.configJson = { ...pointsModule.configJson, currencyLabel };
    pointsModule.updatedAt = new Date().toISOString();
    return { currencyLabel };
  }
  const db = getDb();
  if (!db) throw new Error("currency_storage_unavailable");
  return db.transaction(async (tx) => {
    // Serialize with module/lifecycle changes and verify ownership inside the transaction.
    const [creator] = await tx.select({ id: creators.id }).from(creators)
      .where(and(eq(creators.id, creatorId), eq(creators.ownerUserId, ownerUserId), eq(creators.status, "active")))
      .for("update");
    if (!creator) throw new CurrencyAccessError();
    const [updated] = await tx.update(creatorModules).set({
      configJson: sql`${creatorModules.configJson} || ${JSON.stringify({ currencyLabel })}::jsonb`,
      updatedAt: new Date(),
    }).where(and(eq(creatorModules.creatorId, creatorId), eq(creatorModules.moduleKey, "points"),
      inArray(creatorModules.status, ["installed", "disabled"])))
      .returning({ id: creatorModules.id });
    if (!updated) throw new CurrencyAccessError();
    return { currencyLabel };
  });
}
