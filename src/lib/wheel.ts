import { randomInt, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { streamerbotCounters } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import type { WheelConfigRecord, WheelOptionRecord, WheelSpinRecord } from "@/lib/types";
import { slugify } from "@/lib/utils";

const WHEEL_CONFIG_KEY = "twitch_wheel_config";
const WHEEL_SETTING_SCOPE_TYPE = "setting";
const WHEEL_SETTING_SCOPE_KEY = "twitch_wheel";
const WHEEL_DEFAULT_COLORS = ["#ff66b3", "#41d1ff", "#00beae", "#ffe066", "#b4ff39", "#d7b7ff"];

const DEFAULT_WHEEL_CONFIG: WheelConfigRecord = {
  title: "Roleta da live",
  spinDurationMs: 5200,
  resultHoldSeconds: 30,
  updatedAt: null,
  updatedBy: null,
  lastSpin: null,
  options: [
    { id: "pipetz_bonus", label: "Bônus de pipetz", weight: 1, color: "#ff66b3", isActive: true, sortOrder: 0 },
    { id: "escolhe_jogo", label: "Escolhe um jogo", weight: 1, color: "#41d1ff", isActive: true, sortOrder: 1 },
    { id: "desafio_chat", label: "Desafio do chat", weight: 1, color: "#00beae", isActive: true, sortOrder: 2 },
    { id: "tenta_de_novo", label: "Tenta de novo", weight: 1, color: "#ffe066", isActive: true, sortOrder: 3 },
  ],
};

declare global {
  var __pipetzWheelConfig: WheelConfigRecord | undefined;
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

function sanitizeWheelColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function normalizeWheelOptions(value: unknown): WheelOptionRecord[] {
  const rawOptions = Array.isArray(value) ? value : DEFAULT_WHEEL_CONFIG.options;
  return rawOptions
    .map((entry, index) => {
      const option = entry as Record<string, unknown>;
      const label = typeof option.label === "string" ? option.label.trim() : "";
      if (!label) {
        return null;
      }

      const rawId = typeof option.id === "string" ? option.id.trim() : "";
      const id = rawId || slugify(label) || `option_${index + 1}`;
      const weight =
        typeof option.weight === "number" && Number.isFinite(option.weight)
          ? Math.max(1, Math.min(100, Math.trunc(option.weight)))
          : 1;
      const sortOrder =
        typeof option.sortOrder === "number" && Number.isFinite(option.sortOrder)
          ? Math.max(0, Math.min(999, Math.trunc(option.sortOrder)))
          : index;

      return {
        id: id.slice(0, 64),
        label: label.slice(0, 80),
        weight,
        color: sanitizeWheelColor(option.color, WHEEL_DEFAULT_COLORS[index % WHEEL_DEFAULT_COLORS.length]),
        isActive: option.isActive !== false,
        sortOrder,
      } satisfies WheelOptionRecord;
    })
    .filter((entry): entry is WheelOptionRecord => Boolean(entry))
    .slice(0, 24)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      return left.label.localeCompare(right.label, "pt-BR");
    });
}

function normalizeWheelSpin(value: unknown): WheelSpinRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const spin = value as Record<string, unknown>;
  if (
    typeof spin.spinId !== "string" ||
    typeof spin.optionId !== "string" ||
    typeof spin.label !== "string" ||
    typeof spin.color !== "string" ||
    typeof spin.source !== "string" ||
    typeof spin.startedAt !== "string" ||
    typeof spin.spinDurationMs !== "number" ||
    typeof spin.resultVisibleUntil !== "string"
  ) {
    return null;
  }

  return {
    spinId: spin.spinId,
    optionId: spin.optionId,
    label: spin.label,
    color: sanitizeWheelColor(spin.color, "#41d1ff"),
    requestedBy: typeof spin.requestedBy === "string" ? spin.requestedBy : null,
    source: spin.source,
    startedAt: spin.startedAt,
    spinDurationMs: spin.spinDurationMs,
    resultVisibleUntil: spin.resultVisibleUntil,
  };
}

function serializeWheelConfigRow(row: typeof streamerbotCounters.$inferSelect | null): WheelConfigRecord {
  if (!row) {
    return structuredClone(DEFAULT_WHEEL_CONFIG);
  }

  const metadata = row.metadata as Record<string, unknown>;
  return {
    title:
      typeof metadata.title === "string" && metadata.title.trim()
        ? metadata.title.trim().slice(0, 80)
        : DEFAULT_WHEEL_CONFIG.title,
    spinDurationMs:
      typeof metadata.spinDurationMs === "number" && Number.isFinite(metadata.spinDurationMs)
        ? Math.max(2500, Math.min(12000, Math.trunc(metadata.spinDurationMs)))
        : DEFAULT_WHEEL_CONFIG.spinDurationMs,
    resultHoldSeconds:
      typeof metadata.resultHoldSeconds === "number" && Number.isFinite(metadata.resultHoldSeconds)
        ? Math.max(5, Math.min(120, Math.trunc(metadata.resultHoldSeconds)))
        : DEFAULT_WHEEL_CONFIG.resultHoldSeconds,
    options: normalizeWheelOptions(metadata.options),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: typeof metadata.updatedBy === "string" ? metadata.updatedBy : null,
    lastSpin: normalizeWheelSpin(metadata.lastSpin),
  };
}

function getDemoWheelConfig() {
  globalThis.__pipetzWheelConfig ??= structuredClone(DEFAULT_WHEEL_CONFIG);
  return globalThis.__pipetzWheelConfig;
}

export async function getWheelConfig(): Promise<WheelConfigRecord> {
  const db = getDb();
  if (isDemoMode || !db) {
    return structuredClone(getDemoWheelConfig());
  }

  try {
    const [row] = await db
      .select()
      .from(streamerbotCounters)
      .where(eq(streamerbotCounters.key, WHEEL_CONFIG_KEY))
      .limit(1);
    return serializeWheelConfigRow(row ?? null);
  } catch (error) {
    if (isMissingStreamerbotCountersTableError(error)) {
      return structuredClone(DEFAULT_WHEEL_CONFIG);
    }
    throw error;
  }
}

export async function updateWheelConfig(input: {
  title: string;
  spinDurationMs: number;
  resultHoldSeconds: number;
  options: unknown;
  updatedBy: string | null;
}): Promise<WheelConfigRecord> {
  const current = await getWheelConfig();
  const updatedAt = new Date();
  const metadata = {
    title: input.title,
    spinDurationMs: input.spinDurationMs,
    resultHoldSeconds: input.resultHoldSeconds,
    options: normalizeWheelOptions(input.options),
    lastSpin: current.lastSpin,
    updatedBy: input.updatedBy,
    scopeType: WHEEL_SETTING_SCOPE_TYPE,
    scopeKey: WHEEL_SETTING_SCOPE_KEY,
  };

  if (metadata.options.filter((option) => option.isActive).length < 2) {
    throw new Error("A roleta precisa ter pelo menos duas opções ativas.");
  }

  const db = getDb();
  if (isDemoMode || !db) {
    globalThis.__pipetzWheelConfig = {
      title: metadata.title,
      spinDurationMs: metadata.spinDurationMs,
      resultHoldSeconds: metadata.resultHoldSeconds,
      options: metadata.options,
      updatedAt: updatedAt.toISOString(),
      updatedBy: input.updatedBy,
      lastSpin: current.lastSpin,
    };
    return getWheelConfig();
  }

  await db
    .insert(streamerbotCounters)
    .values({
      key: WHEEL_CONFIG_KEY,
      value: metadata.options.length,
      lastResetAt: null,
      updatedAt,
      metadata,
    })
    .onConflictDoUpdate({
      target: streamerbotCounters.key,
      set: { value: metadata.options.length, updatedAt, metadata },
    });

  return getWheelConfig();
}

function pickWheelOption(options: WheelOptionRecord[]) {
  const active = options.filter((option) => option.isActive);
  const totalWeight = active.reduce((sum, option) => sum + option.weight, 0);
  let ticket = randomInt(1, totalWeight + 1);
  for (const option of active) {
    ticket -= option.weight;
    if (ticket <= 0) {
      return option;
    }
  }
  return active[active.length - 1];
}

export async function triggerWheelSpin(input: {
  requestedBy?: string | null;
  source?: string | null;
}): Promise<WheelConfigRecord> {
  const current = await getWheelConfig();
  const activeOptions = current.options.filter((option) => option.isActive);
  if (activeOptions.length < 2) {
    throw new Error("A roleta precisa ter pelo menos duas opções ativas.");
  }

  const selected = pickWheelOption(current.options);
  const startedAt = new Date();
  const lastSpin: WheelSpinRecord = {
    spinId: randomUUID(),
    optionId: selected.id,
    label: selected.label,
    color: selected.color,
    requestedBy: input.requestedBy?.trim() || null,
    source: input.source?.trim() || "web",
    startedAt: startedAt.toISOString(),
    spinDurationMs: current.spinDurationMs,
    resultVisibleUntil: new Date(startedAt.getTime() + current.spinDurationMs + current.resultHoldSeconds * 1000).toISOString(),
  };

  return updateWheelConfig({
    title: current.title,
    spinDurationMs: current.spinDurationMs,
    resultHoldSeconds: current.resultHoldSeconds,
    options: current.options,
    updatedBy: current.updatedBy,
  }).then(async () => {
    const next = await getWheelConfig();
    next.lastSpin = lastSpin;

    const db = getDb();
    if (isDemoMode || !db) {
      globalThis.__pipetzWheelConfig = next;
      return getWheelConfig();
    }

    await db
      .insert(streamerbotCounters)
      .values({
        key: WHEEL_CONFIG_KEY,
        value: next.options.length,
        lastResetAt: null,
        updatedAt: startedAt,
        metadata: {
          title: next.title,
          spinDurationMs: next.spinDurationMs,
          resultHoldSeconds: next.resultHoldSeconds,
          options: next.options,
          lastSpin,
          updatedBy: next.updatedBy,
          scopeType: WHEEL_SETTING_SCOPE_TYPE,
          scopeKey: WHEEL_SETTING_SCOPE_KEY,
        },
      })
      .onConflictDoUpdate({
        target: streamerbotCounters.key,
        set: {
          value: next.options.length,
          updatedAt: startedAt,
          metadata: {
            title: next.title,
            spinDurationMs: next.spinDurationMs,
            resultHoldSeconds: next.resultHoldSeconds,
            options: next.options,
            lastSpin,
            updatedBy: next.updatedBy,
            scopeType: WHEEL_SETTING_SCOPE_TYPE,
            scopeKey: WHEEL_SETTING_SCOPE_KEY,
          },
        },
      });

    return getWheelConfig();
  });
}
