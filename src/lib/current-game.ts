import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { streamerbotCounters } from "@/lib/db/schema";
import type { CurrentGameRecord } from "@/lib/types";

const CURRENT_GAME_KEY = "current_stream_game";

type CurrentGameInput = Omit<CurrentGameRecord, "updatedAt" | "updatedBy">;

declare global {
  var __lojaCurrentGame: CurrentGameRecord | null | undefined;
}

function getDemoCurrentGame() {
  return globalThis.__lojaCurrentGame ?? null;
}

function setDemoCurrentGame(game: CurrentGameRecord | null) {
  globalThis.__lojaCurrentGame = game;
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

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean)
    : [];
}

function parseCurrentGameRow(row: {
  updatedAt: Date | string;
  metadata: Record<string, unknown>;
}): CurrentGameRecord | null {
  const igdbId = row.metadata.igdbId;
  const name = typeof row.metadata.name === "string" ? row.metadata.name.trim() : "";

  if (!Number.isInteger(igdbId) || typeof igdbId !== "number" || igdbId <= 0 || !name) {
    return null;
  }

  const metadataUpdatedAt = row.metadata.updatedAt;
  const updatedAt =
    typeof metadataUpdatedAt === "string"
      ? metadataUpdatedAt
      : typeof row.updatedAt === "string"
        ? row.updatedAt
        : row.updatedAt.toISOString();

  return {
    igdbId,
    name,
    releaseYear: typeof row.metadata.releaseYear === "number" ? row.metadata.releaseYear : null,
    coverImageUrl:
      typeof row.metadata.coverImageUrl === "string" && row.metadata.coverImageUrl.trim()
        ? row.metadata.coverImageUrl.trim()
        : null,
    platforms: stringArray(row.metadata.platforms).slice(0, 4),
    genres: stringArray(row.metadata.genres).slice(0, 3),
    updatedAt,
    updatedBy: typeof row.metadata.updatedBy === "string" ? row.metadata.updatedBy : null,
  };
}

export async function getCurrentGame(): Promise<CurrentGameRecord | null> {
  const db = getDb();
  if (!db) {
    return getDemoCurrentGame();
  }

  try {
    const [row] = await db
      .select({
        updatedAt: streamerbotCounters.updatedAt,
        metadata: streamerbotCounters.metadata,
      })
      .from(streamerbotCounters)
      .where(eq(streamerbotCounters.key, CURRENT_GAME_KEY))
      .limit(1);

    return row
      ? parseCurrentGameRow({
          updatedAt: row.updatedAt,
          metadata: row.metadata as Record<string, unknown>,
        })
      : null;
  } catch (error) {
    if (isMissingCounterSchemaError(error)) {
      return null;
    }
    throw error;
  }
}

export async function setCurrentGame(input: CurrentGameInput & { updatedBy?: string | null }) {
  const updatedAt = new Date().toISOString();
  const currentGame: CurrentGameRecord = {
    igdbId: input.igdbId,
    name: input.name.trim(),
    releaseYear: input.releaseYear,
    coverImageUrl: input.coverImageUrl,
    platforms: input.platforms.slice(0, 4),
    genres: input.genres.slice(0, 3),
    updatedAt,
    updatedBy: input.updatedBy ?? null,
  };

  if (!currentGame.name) {
    throw new Error("Nome do jogo inválido.");
  }

  const db = getDb();
  if (!db) {
    setDemoCurrentGame(currentGame);
    return currentGame;
  }

  try {
    await db
      .insert(streamerbotCounters)
      .values({
        key: CURRENT_GAME_KEY,
        value: 1,
        lastResetAt: null,
        updatedAt: new Date(updatedAt),
        metadata: currentGame,
      })
      .onConflictDoUpdate({
        target: streamerbotCounters.key,
        set: {
          value: 1,
          updatedAt: new Date(updatedAt),
          metadata: currentGame,
        },
      });
  } catch (error) {
    if (isMissingCounterSchemaError(error)) {
      throw new Error("Schema dos contadores ainda não foi aplicado. Rode npm run db:push.");
    }
    throw error;
  }

  return currentGame;
}

export async function clearCurrentGame() {
  const db = getDb();
  if (!db) {
    setDemoCurrentGame(null);
    return null;
  }

  try {
    await db.delete(streamerbotCounters).where(eq(streamerbotCounters.key, CURRENT_GAME_KEY));
  } catch (error) {
    if (isMissingCounterSchemaError(error)) {
      throw new Error("Schema dos contadores ainda não foi aplicado. Rode npm run db:push.");
    }
    throw error;
  }

  return null;
}
