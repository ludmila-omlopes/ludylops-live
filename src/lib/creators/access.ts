import { createHash } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db/client";
import { streamerbotCounters } from "@/lib/db/schema";
import { adminEmails } from "@/lib/env";
import type { CreatorAreaAccessSettingsRecord, CreatorBetaRequestRecord } from "@/lib/types";

const CREATOR_AREA_ACCESS_KEY = "creator_area_beta_access";
const REQUEST_PREFIX = "creator_beta_request:";

const emailSchema = z.string().trim().email().transform((email) => email.toLowerCase());

export const creatorAreaAccessSchema = z.object({
  allowedEmails: z.array(emailSchema).max(200, "Use até 200 emails."),
});

declare global {
  var __creatorAreaAccessSettings: CreatorAreaAccessSettingsRecord | undefined;
  var __creatorBetaRequests: Map<string, CreatorBetaRequestRecord> | undefined;
  var __creatorBetaLock: Promise<unknown> | undefined;
}

export class CreatorBetaConflictError extends Error {}

type CounterRow = typeof streamerbotCounters.$inferSelect;
type AccessStorage = {
  read: (key: string) => Promise<CounterRow | null>;
  write: (key: string, value: number, metadata: Record<string, unknown>, updatedAt: string) => Promise<void>;
};

// All beta writes share a lock, including manual allowlist edits. No schema migration is needed.
async function mutateAccess<T>(action: (storage: AccessStorage) => Promise<T>): Promise<T> {
  const db = getDb();
  if (db) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${CREATOR_AREA_ACCESS_KEY}, 0))`);
      return action({
        read: async (key) => {
          const [row] = await tx.select().from(streamerbotCounters)
            .where(eq(streamerbotCounters.key, key)).limit(1);
          return row ?? null;
        },
        write: async (key, value, metadata, updatedAt) => {
          const values = { key, value, metadata, updatedAt: new Date(updatedAt) };
          await tx.insert(streamerbotCounters).values(values)
            .onConflictDoUpdate({ target: streamerbotCounters.key, set: values });
        },
      });
    });
  }
  const previous = globalThis.__creatorBetaLock ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(() => action({
    read: async (key) => {
      const metadata = key === CREATOR_AREA_ACCESS_KEY
        ? globalThis.__creatorAreaAccessSettings
        : globalThis.__creatorBetaRequests?.get(key);
      if (!metadata) return null;
      const timestamp = "updatedAt" in metadata ? metadata.updatedAt : metadata.requestedAt;
      return { key, value: 0, metadata, lastResetAt: null, updatedAt: new Date(timestamp ?? 0) };
    },
    write: async (key, _value, metadata) => {
      if (key === CREATOR_AREA_ACCESS_KEY) {
        globalThis.__creatorAreaAccessSettings = metadata as unknown as CreatorAreaAccessSettingsRecord;
      } else {
        (globalThis.__creatorBetaRequests ??= new Map()).set(key, metadata as unknown as CreatorBetaRequestRecord);
      }
    },
  }));
  globalThis.__creatorBetaLock = operation;
  return operation;
}

function requestId(email: string) {
  return `${REQUEST_PREFIX}${createHash("sha256").update(email).digest("hex").slice(0, 40)}`;
}

function serializeRequest(row: CounterRow | null): CreatorBetaRequestRecord | null {
  return row ? row.metadata as CreatorBetaRequestRecord : null;
}

async function writeSettings(storage: AccessStorage, row: CounterRow | null, allowedEmails: string[], updatedBy: string | null) {
  const updatedAt = new Date(Math.max(Date.now(), (row?.updatedAt.getTime() ?? 0) + 1)).toISOString();
  const settings = { allowedEmails: normalizeAllowedEmails({ allowedEmails }), updatedAt, updatedBy };
  const metadata = { ...(row?.metadata as object), ...settings };
  await storage.write(CREATOR_AREA_ACCESS_KEY, settings.allowedEmails.length, metadata, settings.updatedAt);
  return settings;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeAllowedEmails(input: unknown) {
  const parsed = creatorAreaAccessSchema.parse(input);
  return Array.from(new Set(parsed.allowedEmails)).sort((a, b) => a.localeCompare(b));
}

export function parseCreatorAreaAccessText(value: string) {
  return value
    .split(/[\s,;]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function defaultSettings(): CreatorAreaAccessSettingsRecord {
  return {
    allowedEmails: [],
    updatedAt: null,
    updatedBy: null,
  };
}

function serializeSettings(row: typeof streamerbotCounters.$inferSelect | null): CreatorAreaAccessSettingsRecord {
  if (!row) {
    return defaultSettings();
  }

  const metadata = row.metadata as Record<string, unknown>;
  const allowedEmails = Array.isArray(metadata.allowedEmails)
    ? metadata.allowedEmails.filter((entry): entry is string => typeof entry === "string")
    : [];

  return {
    allowedEmails,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    updatedBy: typeof metadata.updatedBy === "string" ? metadata.updatedBy : null,
  };
}

export async function getCreatorAreaAccessSettings(): Promise<CreatorAreaAccessSettingsRecord> {
  const db = getDb();
  if (!db) {
    return globalThis.__creatorAreaAccessSettings ?? defaultSettings();
  }

  const [row] = await db
    .select()
    .from(streamerbotCounters)
    .where(eq(streamerbotCounters.key, CREATOR_AREA_ACCESS_KEY))
    .limit(1);

  return serializeSettings(row ?? null);
}

export async function updateCreatorAreaAccessSettings(input: {
  allowedEmails: string[];
  updatedBy: string | null;
  expectedUpdatedAt?: string | null;
}) {
  const allowedEmails = normalizeAllowedEmails({ allowedEmails: input.allowedEmails });
  return mutateAccess(async (storage) => {
    const row = await storage.read(CREATOR_AREA_ACCESS_KEY);
    if (input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== serializeSettings(row).updatedAt) {
      throw new CreatorBetaConflictError("A lista foi alterada. Atualize os emails antes de salvar novamente.");
    }
    return writeSettings(storage, row, allowedEmails, input.updatedBy);
  });
}

export async function getCreatorBetaRequest(email: string) {
  const id = requestId(emailSchema.parse(email));
  const db = getDb();
  if (!db) return globalThis.__creatorBetaRequests?.get(id) ?? null;
  const [row] = await db.select().from(streamerbotCounters)
    .where(eq(streamerbotCounters.key, id)).limit(1);
  return serializeRequest(row ?? null);
}

export async function submitCreatorBetaRequest(email: string) {
  const normalizedEmail = emailSchema.parse(email);
  return mutateAccess(async (storage) => {
    const settings = serializeSettings(await storage.read(CREATOR_AREA_ACCESS_KEY));
    const id = requestId(normalizedEmail);
    const existing = serializeRequest(await storage.read(id));
    if (adminEmails.has(normalizedEmail) || settings.allowedEmails.includes(normalizedEmail)) {
      return { canCreate: true, request: existing };
    }
    if (existing?.status === "pending") return { canCreate: false, request: existing };
    const request: CreatorBetaRequestRecord = {
      id, email: normalizedEmail, status: "pending", requestedAt: nowIso(), reviewedAt: null, reviewedBy: null,
    };
    await storage.write(id, 0, { ...request }, request.requestedAt);
    return { canCreate: false, request };
  });
}

export async function listPendingCreatorBetaRequests(cursor?: string) {
  const db = getDb();
  let requests: CreatorBetaRequestRecord[];
  if (db) {
    const rows = await db.select().from(streamerbotCounters).where(and(
      sql`starts_with(${streamerbotCounters.key}, ${REQUEST_PREFIX})`,
      eq(streamerbotCounters.value, 0),
      cursor ? gt(streamerbotCounters.key, cursor) : undefined,
    )).orderBy(streamerbotCounters.key).limit(51);
    requests = rows.map((row) => serializeRequest(row)!);
  } else {
    requests = [...(globalThis.__creatorBetaRequests?.values() ?? [])]
      .filter((request) => request.status === "pending" && (!cursor || request.id > cursor))
      .sort((a, b) => a.id.localeCompare(b.id)).slice(0, 51);
  }
  return { requests: requests.slice(0, 50), nextCursor: requests.length > 50 ? requests[49].id : null };
}

export async function reviewCreatorBetaRequest(id: string, decision: "approved" | "rejected", reviewedBy: string) {
  if (!/^creator_beta_request:[a-f0-9]{40}$/.test(id)) throw new CreatorBetaConflictError("Solicitação inválida.");
  return mutateAccess(async (storage) => {
    const request = serializeRequest(await storage.read(id));
    if (!request) throw new CreatorBetaConflictError("Solicitação não encontrada.");
    const settingsRow = await storage.read(CREATOR_AREA_ACCESS_KEY);
    let settings = serializeSettings(settingsRow);
    if (request.status !== "pending") {
      if (request.status === decision) return { request, settings };
      throw new CreatorBetaConflictError("Esta solicitação já foi analisada. Atualize os pedidos.");
    }
    if (decision === "rejected" && settings.allowedEmails.includes(request.email)) {
      throw new CreatorBetaConflictError("Esse email já está liberado. Atualize os pedidos.");
    }
    if (decision === "approved" && !settings.allowedEmails.includes(request.email)) {
      settings = await writeSettings(storage, settingsRow, [...settings.allowedEmails, request.email], reviewedBy);
    }
    const reviewed = { ...request, status: decision, reviewedAt: nowIso(), reviewedBy };
    await storage.write(id, decision === "approved" ? 1 : -1, reviewed, reviewed.reviewedAt);
    return { request: reviewed, settings };
  });
}

export async function canCreateCreatorArea(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  if (adminEmails.has(normalizedEmail)) {
    return true;
  }

  const settings = await getCreatorAreaAccessSettings();
  return settings.allowedEmails.includes(normalizedEmail);
}
