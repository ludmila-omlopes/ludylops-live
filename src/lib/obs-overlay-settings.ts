import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { streamerbotCounters } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import {
  type ObsOverlayStyle,
  type ObsOverlayStyleConfigRecord,
  getObsOverlayStyleFromSearchParamsRecord,
  normalizeObsOverlayStyle,
} from "@/lib/obs-overlay-style";

const OBS_OVERLAY_STYLE_KEY = "obs_overlay_style";
const OBS_OVERLAY_STYLE_SCOPE_TYPE = "setting";
const OBS_OVERLAY_STYLE_SCOPE_KEY = "obs_overlays";

const DEFAULT_OBS_OVERLAY_STYLE_CONFIG: ObsOverlayStyleConfigRecord = {
  style: "classic",
  updatedAt: null,
  updatedBy: null,
};

declare global {
  var __pipetzObsOverlayStyleConfig: ObsOverlayStyleConfigRecord | undefined;
}

function isMissingStreamerbotCountersTableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const maybePostgresError = error as Error & {
    code?: string;
    cause?: { code?: string; message?: string };
  };
  const message = `${error.message} ${maybePostgresError.cause?.message ?? ""}`;

  return (
    maybePostgresError.code === "42P01" ||
    maybePostgresError.cause?.code === "42P01" ||
    message.includes('relation "streamerbot_counters" does not exist')
  );
}

function serializeObsOverlayStyleConfig(row: typeof streamerbotCounters.$inferSelect | null) {
  if (!row) {
    return { ...DEFAULT_OBS_OVERLAY_STYLE_CONFIG };
  }

  const metadata = row.metadata as Record<string, unknown>;
  return {
    style: normalizeObsOverlayStyle(metadata.style) ?? DEFAULT_OBS_OVERLAY_STYLE_CONFIG.style,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: typeof metadata.updatedBy === "string" ? metadata.updatedBy : null,
  } satisfies ObsOverlayStyleConfigRecord;
}

function getDemoObsOverlayStyleConfig() {
  globalThis.__pipetzObsOverlayStyleConfig ??= { ...DEFAULT_OBS_OVERLAY_STYLE_CONFIG };
  return globalThis.__pipetzObsOverlayStyleConfig;
}

export async function getObsOverlayStyleConfig(): Promise<ObsOverlayStyleConfigRecord> {
  const db = getDb();
  if (isDemoMode || !db) {
    return { ...getDemoObsOverlayStyleConfig() };
  }

  try {
    const [row] = await db
      .select()
      .from(streamerbotCounters)
      .where(eq(streamerbotCounters.key, OBS_OVERLAY_STYLE_KEY))
      .limit(1);

    return serializeObsOverlayStyleConfig(row ?? null);
  } catch (error) {
    if (isMissingStreamerbotCountersTableError(error)) {
      return { ...DEFAULT_OBS_OVERLAY_STYLE_CONFIG };
    }
    throw error;
  }
}

export async function updateObsOverlayStyleConfig(input: {
  style: ObsOverlayStyle;
  updatedBy?: string | null;
}) {
  const now = new Date();
  const metadata = {
    style: input.style,
    updatedBy: input.updatedBy ?? null,
    scopeType: OBS_OVERLAY_STYLE_SCOPE_TYPE,
    scopeKey: OBS_OVERLAY_STYLE_SCOPE_KEY,
  };
  const db = getDb();

  if (isDemoMode || !db) {
    globalThis.__pipetzObsOverlayStyleConfig = {
      style: input.style,
      updatedAt: now.toISOString(),
      updatedBy: input.updatedBy ?? null,
    };
    return getObsOverlayStyleConfig();
  }

  await db
    .insert(streamerbotCounters)
    .values({
      key: OBS_OVERLAY_STYLE_KEY,
      value: input.style === "obscur" ? 1 : 0,
      lastResetAt: null,
      updatedAt: now,
      metadata,
    })
    .onConflictDoUpdate({
      target: streamerbotCounters.key,
      set: {
        value: input.style === "obscur" ? 1 : 0,
        updatedAt: now,
        metadata,
      },
    });

  return getObsOverlayStyleConfig();
}

export async function resolveObsOverlayInitialStyle(
  searchParams: Promise<Record<string, string | string[] | undefined>>,
): Promise<ObsOverlayStyle> {
  const resolvedSearchParams = await searchParams;
  const override = getObsOverlayStyleFromSearchParamsRecord(resolvedSearchParams);
  if (override) {
    return override;
  }

  return (await getObsOverlayStyleConfig()).style;
}
