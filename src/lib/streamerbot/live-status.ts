import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { googleAccounts, googleAccountViewers, streamerbotCounters, users } from "@/lib/db/schema";
import { adminEmails, env } from "@/lib/env";
import type {
  LivestreamManualOverrideRecord,
  LivestreamStatusRecord,
  StreamerbotEventType,
} from "@/lib/types";

const LIVE_REQUIRED_EVENT_TYPES: StreamerbotEventType[] = [
  "presence_tick",
  "chat_bonus",
  "like_count_update",
];
const LIVE_STATUS_CACHE_TTL_MS = 15_000;
const LIVE_STATUS_REQUEST_TIMEOUT_MS = 5_000;
const LIVESTREAM_OVERRIDE_COUNTER_KEY = "livestream_override";

type LiveStatusCacheEntry = {
  expiresAt: number;
  isLive: boolean;
};

declare global {
  var __lojaYoutubeLiveStatusCache: Map<string, LiveStatusCacheEntry> | undefined;
  var __lojaYoutubeLiveStatusWarnedMissingKey: boolean | undefined;
  var __lojaYoutubeLiveStatusWarnedMissingChannelIds: boolean | undefined;
  var __lojaManualLivestreamOverride: LivestreamManualOverrideRecord | null | undefined;
}

function getLiveStatusCache() {
  if (!globalThis.__lojaYoutubeLiveStatusCache) {
    globalThis.__lojaYoutubeLiveStatusCache = new Map<string, LiveStatusCacheEntry>();
  }

  return globalThis.__lojaYoutubeLiveStatusCache;
}

function warnOnce(flag: "missingKey" | "missingChannelIds", message: string) {
  if (flag === "missingKey") {
    if (globalThis.__lojaYoutubeLiveStatusWarnedMissingKey) {
      return;
    }
    globalThis.__lojaYoutubeLiveStatusWarnedMissingKey = true;
    console.warn(message);
    return;
  }

  if (globalThis.__lojaYoutubeLiveStatusWarnedMissingChannelIds) {
    return;
  }
  globalThis.__lojaYoutubeLiveStatusWarnedMissingChannelIds = true;
  console.warn(message);
}

function clearLiveStatusCache() {
  getLiveStatusCache().clear();
}

function getDemoLivestreamManualOverride() {
  return globalThis.__lojaManualLivestreamOverride ?? null;
}

function setDemoLivestreamManualOverride(override: LivestreamManualOverrideRecord | null) {
  globalThis.__lojaManualLivestreamOverride = override;
}

function parseLivestreamManualOverrideRow(
  row:
    | {
        value: number;
        updatedAt: Date;
        metadata: Record<string, unknown>;
      }
    | {
        value: number;
        updatedAt: string;
        metadata: Record<string, unknown>;
      },
): LivestreamManualOverrideRecord | null {
  if (row.metadata.mode !== "manual") {
    return null;
  }

  const metadataIsLive = row.metadata.isLive;
  const isLive =
    typeof metadataIsLive === "boolean" ? metadataIsLive : row.value > 0;
  const metadataUpdatedAt = row.metadata.updatedAt;
  const updatedAt =
    typeof metadataUpdatedAt === "string"
      ? metadataUpdatedAt
      : typeof row.updatedAt === "string"
        ? row.updatedAt
        : row.updatedAt.toISOString();

  return {
    isLive,
    updatedAt,
    updatedBy:
      typeof row.metadata.updatedBy === "string" ? row.metadata.updatedBy : null,
  };
}

function isMissingCounterSchemaError(error: unknown) {
  const tableNames = ['"streamerbot_counters"', "streamerbot_counters"];
  const queue: unknown[] = [error];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const message =
      current instanceof Error ? current.message : typeof current === "string" ? current : "";
    const normalized = message.toLowerCase();
    const mentionsTable = tableNames.some((tableName) => normalized.includes(tableName));

    if (
      mentionsTable &&
      (normalized.includes("does not exist") ||
        normalized.includes("relation") ||
        normalized.includes("table") ||
        normalized.includes("failed query"))
    ) {
      return true;
    }

    if (typeof current === "object" && current && "cause" in current) {
      queue.push((current as { cause?: unknown }).cause);
    }
  }

  return false;
}

async function getLivestreamManualOverride() {
  const db = getDb();
  if (!db) {
    return getDemoLivestreamManualOverride();
  }

  let row:
    | {
        value: number;
        updatedAt: Date;
        metadata: unknown;
      }
    | undefined;

  try {
    [row] = await db
      .select({
        value: streamerbotCounters.value,
        updatedAt: streamerbotCounters.updatedAt,
        metadata: streamerbotCounters.metadata,
      })
      .from(streamerbotCounters)
      .where(eq(streamerbotCounters.key, LIVESTREAM_OVERRIDE_COUNTER_KEY))
      .limit(1);
  } catch (error) {
    if (isMissingCounterSchemaError(error)) {
      return null;
    }
    throw error;
  }

  if (!row) {
    return null;
  }

  return parseLivestreamManualOverrideRow({
    value: row.value,
    updatedAt: row.updatedAt,
    metadata: row.metadata as Record<string, unknown>,
  });
}

function getConfiguredChannelIds() {
  return (env.STREAM_YOUTUBE_CHANNEL_ID ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function resolveTrackedYoutubeChannelIds() {
  const configuredChannelIds = getConfiguredChannelIds();
  if (configuredChannelIds.length > 0) {
    return configuredChannelIds;
  }

  const db = getDb();
  if (!db || adminEmails.size === 0) {
    return [];
  }

  const rows = await db
    .select({
      email: googleAccounts.email,
      youtubeChannelId: users.youtubeChannelId,
    })
    .from(googleAccountViewers)
    .innerJoin(googleAccounts, eq(googleAccountViewers.googleAccountId, googleAccounts.id))
    .innerJoin(users, eq(googleAccountViewers.viewerId, users.id))
    .where(eq(users.isLinked, true));

  const channelIds = new Set<string>();
  for (const row of rows) {
    if (!row.email || !adminEmails.has(row.email.toLowerCase())) {
      continue;
    }

    channelIds.add(row.youtubeChannelId);
  }

  return Array.from(channelIds);
}

async function fetchChannelLiveStatus(channelId: string) {
  const cache = getLiveStatusCache();
  const cached = cache.get(channelId);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.isLive;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_STATUS_REQUEST_TIMEOUT_MS);

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("channelId", channelId);
    url.searchParams.set("eventType", "live");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "1");
    url.searchParams.set("key", env.YOUTUBE_API_KEY ?? "");

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`youtube_live_status_${response.status}`);
    }

    const payload = (await response.json()) as { items?: unknown[] };
    const isLive = Array.isArray(payload.items) && payload.items.length > 0;
    cache.set(channelId, {
      expiresAt: now + LIVE_STATUS_CACHE_TTL_MS,
      isLive,
    });
    return isLive;
  } catch (error) {
    console.warn("[streamerbot/live] Failed to verify YouTube live status.", {
      channelId,
      error,
    });
    return cached?.isLive ?? false;
  } finally {
    clearTimeout(timeout);
  }
}

async function getAutomaticLivestreamState() {
  if (!env.YOUTUBE_API_KEY) {
    warnOnce(
      "missingKey",
      "[streamerbot/live] Missing YOUTUBE_API_KEY. Live-gated Streamer.bot events will be ignored.",
    );
    return false;
  }

  const channelIds = await resolveTrackedYoutubeChannelIds();
  if (channelIds.length === 0) {
    warnOnce(
      "missingChannelIds",
      "[streamerbot/live] No tracked YouTube channel ids found. Link an admin account or set STREAM_YOUTUBE_CHANNEL_ID.",
    );
    return false;
  }

  for (const channelId of channelIds) {
    if (await fetchChannelLiveStatus(channelId)) {
      return true;
    }
  }

  return false;
}

export function eventRequiresActiveLivestream(eventType: StreamerbotEventType) {
  return LIVE_REQUIRED_EVENT_TYPES.includes(eventType);
}

export async function getStreamerbotLivestreamStatus(): Promise<LivestreamStatusRecord> {
  const manualOverride = await getLivestreamManualOverride();
  if (manualOverride) {
    return {
      isLive: manualOverride.isLive,
      source: "manual",
      manualOverride,
    };
  }

  return {
    isLive: await getAutomaticLivestreamState(),
    source: "automatic",
    manualOverride: null,
  };
}

export async function setStreamerbotLivestreamManualOverride(input: {
  isLive: boolean;
  updatedBy?: string | null;
}) {
  const override: LivestreamManualOverrideRecord = {
    isLive: input.isLive,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy ?? null,
  };
  const db = getDb();

  if (!db) {
    setDemoLivestreamManualOverride(override);
    clearLiveStatusCache();
    return getStreamerbotLivestreamStatus();
  }

  try {
    await db
      .insert(streamerbotCounters)
      .values({
        key: LIVESTREAM_OVERRIDE_COUNTER_KEY,
        value: input.isLive ? 1 : 0,
        lastResetAt: null,
        updatedAt: new Date(override.updatedAt),
        metadata: {
          mode: "manual",
          isLive: input.isLive,
          updatedAt: override.updatedAt,
          updatedBy: override.updatedBy,
        },
      })
      .onConflictDoUpdate({
        target: streamerbotCounters.key,
        set: {
          value: input.isLive ? 1 : 0,
          updatedAt: new Date(override.updatedAt),
          metadata: {
            mode: "manual",
            isLive: input.isLive,
            updatedAt: override.updatedAt,
            updatedBy: override.updatedBy,
          },
        },
      });
  } catch (error) {
    if (isMissingCounterSchemaError(error)) {
      throw new Error("Schema dos contadores ainda nao foi aplicado. Rode npm run db:push.");
    }
    throw error;
  }

  clearLiveStatusCache();
  return getStreamerbotLivestreamStatus();
}

export async function clearStreamerbotLivestreamManualOverride() {
  const db = getDb();
  if (!db) {
    setDemoLivestreamManualOverride(null);
    clearLiveStatusCache();
    return getStreamerbotLivestreamStatus();
  }

  try {
    await db
      .delete(streamerbotCounters)
      .where(eq(streamerbotCounters.key, LIVESTREAM_OVERRIDE_COUNTER_KEY));
  } catch (error) {
    if (isMissingCounterSchemaError(error)) {
      throw new Error("Schema dos contadores ainda nao foi aplicado. Rode npm run db:push.");
    }
    throw error;
  }

  clearLiveStatusCache();
  return getStreamerbotLivestreamStatus();
}

export async function resolveRequiredLivestreamState(input?: {
  explicitState?: boolean | null;
}) {
  if (typeof input?.explicitState === "boolean") {
    return input.explicitState;
  }

  return isStreamerbotLivestreamActive();
}

export async function requireActiveLivestream(input?: {
  explicitState?: boolean | null;
  failureError?: string;
}) {
  const isLive = await resolveRequiredLivestreamState({
    explicitState: input?.explicitState ?? null,
  });

  if (!isLive) {
    throw new Error(input?.failureError ?? "livestream_not_live");
  }

  return true;
}

export async function isStreamerbotLivestreamActive() {
  const status = await getStreamerbotLivestreamStatus();
  return status.isLive;
}
