import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db/client";
import { streamerbotCounters } from "@/lib/db/schema";
import { adminEmails } from "@/lib/env";
import type { CreatorAreaAccessSettingsRecord } from "@/lib/types";

const CREATOR_AREA_ACCESS_KEY = "creator_area_beta_access";

const emailSchema = z.string().trim().email().transform((email) => email.toLowerCase());

export const creatorAreaAccessSchema = z.object({
  allowedEmails: z.array(emailSchema).max(200, "Use até 200 emails."),
});

declare global {
  var __creatorAreaAccessSettings: CreatorAreaAccessSettingsRecord | undefined;
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
}) {
  const allowedEmails = normalizeAllowedEmails({ allowedEmails: input.allowedEmails });
  const updatedAt = nowIso();
  const settings: CreatorAreaAccessSettingsRecord = {
    allowedEmails,
    updatedAt,
    updatedBy: input.updatedBy,
  };
  const db = getDb();

  if (!db) {
    globalThis.__creatorAreaAccessSettings = settings;
    return settings;
  }

  const metadata = {
    allowedEmails,
    updatedAt,
    updatedBy: input.updatedBy,
  };

  await db
    .insert(streamerbotCounters)
    .values({
      key: CREATOR_AREA_ACCESS_KEY,
      value: allowedEmails.length,
      metadata,
    })
    .onConflictDoUpdate({
      target: streamerbotCounters.key,
      set: {
        value: allowedEmails.length,
        metadata,
        updatedAt: new Date(updatedAt),
      },
    });

  return settings;
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
