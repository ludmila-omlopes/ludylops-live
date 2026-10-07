import { createHash } from "node:crypto";
import { and, asc, desc, eq, gt, gte, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { streamerbotEventLog } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import { requireCreatorContext, type CreatorContext } from "@/lib/creators/context";
import { superStickerSchema, stickerCursorSchema, STICKER_MAX_AGE_MS, type StickerAlert, type StickerBatch, type SuperStickerInput } from "@/lib/youtube-stickers";

const EVENT_TYPE = "youtube_super_sticker";
type DemoAlert = StickerAlert & { creatorId: string };
declare global { var __youtubeStickerDemoAlerts: DemoAlert[] | undefined; }
function getDemoAlerts() {
  return globalThis.__youtubeStickerDemoAlerts ??= [];
}

function toAlert(id: string, receivedAt: string, payload: SuperStickerInput): StickerAlert {
  return { id, receivedAt, displayName: payload.displayName || "Alguém", amount: payload.amount,
    stickerAltText: payload.stickerAltText || "Super Sticker", stickerImageUrl: payload.stickerImageUrl };
}

export async function receiveSuperSticker(context: CreatorContext, input: SuperStickerInput) {
  const creatorId = requireCreatorContext(context);
  const payload = superStickerSchema.parse(input);
  const id = createHash("sha256").update(JSON.stringify([EVENT_TYPE, creatorId, payload.messageId])).digest("hex");
  const db = getDb();
  if (isDemoMode) {
    const demoAlerts = getDemoAlerts();
    const cutoff = Date.now() - STICKER_MAX_AGE_MS;
    for (let i = demoAlerts.length - 1; i >= 0; i--) if (Date.parse(demoAlerts[i].receivedAt) < cutoff) demoAlerts.splice(i, 1);
    if (demoAlerts.some(alert => alert.id === id)) return { deduped: true };
    const previous = demoAlerts.filter(alert => alert.creatorId === creatorId).at(-1);
    const receivedAt = new Date(Math.max(Date.now(), previous ? Date.parse(previous.receivedAt) + 1 : 0));
    demoAlerts.push({ ...toAlert(id, receivedAt.toISOString(), payload), creatorId });
    return { deduped: false };
  }
  if (!db) throw new Error("sticker_storage_unavailable");
  return db.transaction(async tx => {
    // Serialize only this creator's stickers so concurrent commits cannot arrive behind the cursor.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`stickers:${creatorId}`}, 0))`);
    const [last] = await tx.select({ occurredAt: streamerbotEventLog.occurredAt }).from(streamerbotEventLog)
      .where(and(eq(streamerbotEventLog.creatorId, creatorId), eq(streamerbotEventLog.eventType, EVENT_TYPE)))
      .orderBy(desc(streamerbotEventLog.occurredAt)).limit(1);
    const receivedAt = new Date(Math.max(Date.now(), last ? last.occurredAt.getTime() + 1 : 0));
    const inserted = await tx.insert(streamerbotEventLog).values({
      id, creatorId, eventId: `sticker-${id}`, eventType: EVENT_TYPE,
      payload, occurredAt: receivedAt, signatureValid: true,
    }).onConflictDoNothing({ target: streamerbotEventLog.eventId }).returning({ id: streamerbotEventLog.id });
    return { deduped: inserted.length === 0 };
  });
}

export async function listSuperStickers(context: CreatorContext, cursor?: string): Promise<StickerBatch> {
  const creatorId = requireCreatorContext(context);
  const start = cursor ? stickerCursorSchema.parse(cursor) : `${new Date(Date.now() - 120_000).toISOString()}|`;
  const [time, id] = start.split("|");
  const since = new Date(Math.max(Date.parse(time), Date.now() - STICKER_MAX_AGE_MS));
  const db = getDb();
  let alerts: StickerAlert[];
  let nextCursor = `${since.toISOString()}|${since.getTime() === Date.parse(time) ? id : ""}`;
  if (isDemoMode) {
    const demoAlerts = getDemoAlerts();
    alerts = demoAlerts.filter(alert => alert.creatorId === creatorId &&
      Date.parse(alert.receivedAt) >= since.getTime() && `${alert.receivedAt}|${alert.id}` > nextCursor)
      .sort((a, b) => `${a.receivedAt}|${a.id}`.localeCompare(`${b.receivedAt}|${b.id}`)).slice(0, 50)
      .map(alert => ({ id: alert.id, receivedAt: alert.receivedAt, displayName: alert.displayName,
        amount: alert.amount, stickerAltText: alert.stickerAltText, stickerImageUrl: alert.stickerImageUrl }));
    const last = alerts.at(-1);
    if (last) nextCursor = `${last.receivedAt}|${last.id}`;
  } else {
    if (!db) throw new Error("sticker_storage_unavailable");
    const rows = await db.select({ id: streamerbotEventLog.id, occurredAt: streamerbotEventLog.occurredAt, payload: streamerbotEventLog.payload })
      .from(streamerbotEventLog).where(and(
        eq(streamerbotEventLog.creatorId, creatorId), eq(streamerbotEventLog.eventType, EVENT_TYPE),
        eq(streamerbotEventLog.signatureValid, true), gte(streamerbotEventLog.occurredAt, since),
        or(gt(streamerbotEventLog.occurredAt, new Date(time)), and(eq(streamerbotEventLog.occurredAt, new Date(time)), gt(streamerbotEventLog.id, id))),
      )).orderBy(asc(streamerbotEventLog.occurredAt), asc(streamerbotEventLog.id)).limit(50);
    alerts = rows.flatMap(row => {
      const parsed = superStickerSchema.safeParse(row.payload);
      return parsed.success ? [toAlert(row.id, row.occurredAt.toISOString(), parsed.data)] : [];
    });
    const last = rows.at(-1);
    if (last) nextCursor = `${last.occurredAt.toISOString()}|${last.id}`;
  }
  return { alerts, cursor: nextCursor };
}
