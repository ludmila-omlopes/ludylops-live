import { createHash } from "node:crypto";
import { and, asc, desc, eq, gt, gte, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/lib/db/client";
import { streamerbotEventLog } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import { requireCreatorContext, type CreatorContext } from "@/lib/creators/context";
import { stickerCursorSchema, STICKER_MAX_AGE_MS } from "@/lib/youtube-stickers";

type BaseAlert = { id: string; receivedAt: string };
type DemoAlert<Alert> = Alert & { creatorId: string };
type DemoStores = Record<string, DemoAlert<BaseAlert>[]>;

/**
 * Ordered, per-creator feed of YouTube alerts delivered by Streamer.bot and read by an OBS overlay.
 * Rows live in `streamerbot_event_log`; nothing touches points, balances or rewards.
 */
export function createYoutubeAlertFeed<Schema extends z.ZodType, Alert extends BaseAlert>(options: {
  eventType: string;
  /** Prefix for `event_id`, the unique column used for deduplication. */
  eventIdPrefix: string;
  /** Prefix for the per-creator advisory lock that keeps the cursor ordered. */
  lockPrefix: string;
  /** Name of the `globalThis` property that keeps demo alerts across route modules. */
  demoGlobal: string;
  schema: Schema;
  dedupeKey: (payload: z.output<Schema>) => string;
  toAlert: (id: string, receivedAt: string, payload: z.output<Schema>) => Alert;
}) {
  const unavailable = `${options.eventIdPrefix}_storage_unavailable`;
  function demoAlerts() {
    const stores = globalThis as unknown as DemoStores;
    return (stores[options.demoGlobal] ??= []) as DemoAlert<Alert>[];
  }

  async function receive(context: CreatorContext, input: z.input<Schema>) {
    const creatorId = requireCreatorContext(context);
    const payload = options.schema.parse(input) as z.output<Schema>;
    const id = createHash("sha256").update(JSON.stringify([options.eventType, creatorId, options.dedupeKey(payload)])).digest("hex");
    const db = getDb();
    if (isDemoMode) {
      const alerts = demoAlerts();
      const cutoff = Date.now() - STICKER_MAX_AGE_MS;
      for (let i = alerts.length - 1; i >= 0; i--) if (Date.parse(alerts[i].receivedAt) < cutoff) alerts.splice(i, 1);
      if (alerts.some(alert => alert.id === id)) return { deduped: true };
      const previous = alerts.filter(alert => alert.creatorId === creatorId).at(-1);
      const receivedAt = new Date(Math.max(Date.now(), previous ? Date.parse(previous.receivedAt) + 1 : 0));
      alerts.push({ ...options.toAlert(id, receivedAt.toISOString(), payload), creatorId });
      return { deduped: false };
    }
    if (!db) throw new Error(unavailable);
    return db.transaction(async tx => {
      // Serialize only this creator's alerts so concurrent commits cannot arrive behind the cursor.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${options.lockPrefix}:${creatorId}`}, 0))`);
      const [last] = await tx.select({ occurredAt: streamerbotEventLog.occurredAt }).from(streamerbotEventLog)
        .where(and(eq(streamerbotEventLog.creatorId, creatorId), eq(streamerbotEventLog.eventType, options.eventType)))
        .orderBy(desc(streamerbotEventLog.occurredAt)).limit(1);
      const receivedAt = new Date(Math.max(Date.now(), last ? last.occurredAt.getTime() + 1 : 0));
      const inserted = await tx.insert(streamerbotEventLog).values({
        id, creatorId, eventId: `${options.eventIdPrefix}-${id}`, eventType: options.eventType,
        payload, occurredAt: receivedAt, signatureValid: true,
      }).onConflictDoNothing({ target: streamerbotEventLog.eventId }).returning({ id: streamerbotEventLog.id });
      return { deduped: inserted.length === 0 };
    });
  }

  async function list(context: CreatorContext, cursor?: string): Promise<{ alerts: Alert[]; cursor: string }> {
    const creatorId = requireCreatorContext(context);
    const start = cursor ? stickerCursorSchema.parse(cursor) : `${new Date(Date.now() - 120_000).toISOString()}|`;
    const [time, id] = start.split("|");
    const since = new Date(Math.max(Date.parse(time), Date.now() - STICKER_MAX_AGE_MS));
    const db = getDb();
    let alerts: Alert[];
    let nextCursor = `${since.toISOString()}|${since.getTime() === Date.parse(time) ? id : ""}`;
    if (isDemoMode) {
      alerts = demoAlerts().filter(alert => alert.creatorId === creatorId &&
        Date.parse(alert.receivedAt) >= since.getTime() && `${alert.receivedAt}|${alert.id}` > nextCursor)
        .sort((a, b) => `${a.receivedAt}|${a.id}`.localeCompare(`${b.receivedAt}|${b.id}`)).slice(0, 50)
        .map(alert => {
          const publicAlert: Partial<DemoAlert<Alert>> = { ...alert };
          delete publicAlert.creatorId;
          return publicAlert as Alert;
        });
      const last = alerts.at(-1);
      if (last) nextCursor = `${last.receivedAt}|${last.id}`;
    } else {
      if (!db) throw new Error(unavailable);
      const rows = await db.select({ id: streamerbotEventLog.id, occurredAt: streamerbotEventLog.occurredAt, payload: streamerbotEventLog.payload })
        .from(streamerbotEventLog).where(and(
          eq(streamerbotEventLog.creatorId, creatorId), eq(streamerbotEventLog.eventType, options.eventType),
          eq(streamerbotEventLog.signatureValid, true), gte(streamerbotEventLog.occurredAt, since),
          or(gt(streamerbotEventLog.occurredAt, new Date(time)), and(eq(streamerbotEventLog.occurredAt, new Date(time)), gt(streamerbotEventLog.id, id))),
        )).orderBy(asc(streamerbotEventLog.occurredAt), asc(streamerbotEventLog.id)).limit(50);
      alerts = rows.flatMap(row => {
        const parsed = options.schema.safeParse(row.payload);
        return parsed.success ? [options.toAlert(row.id, row.occurredAt.toISOString(), parsed.data as z.output<Schema>)] : [];
      });
      const last = rows.at(-1);
      if (last) nextCursor = `${last.occurredAt.toISOString()}|${last.id}`;
    }
    return { alerts, cursor: nextCursor };
  }

  return { receive, list };
}
