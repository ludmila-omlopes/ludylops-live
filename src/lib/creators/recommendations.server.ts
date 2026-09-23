import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { creators, creatorModules, productRecommendations } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import { canUseModules } from "./module-access";
import { createRecommendationSchema, updateRecommendationSchema, recommendationInput,
  type CreatorRecommendation, type CreatorRecommendationInput, type CreatorRecommendationPage } from "./recommendations";

export class RecommendationAccessError extends Error {}
export class RecommendationConflictError extends Error {}
type Row = typeof productRecommendations.$inferSelect;
type Tx = Parameters<Parameters<NonNullable<ReturnType<typeof getDb>>["transaction"]>[0]>[0];
declare global { var __creatorRecommendationsDemo: Row[] | undefined; }
const demo = () => globalThis.__creatorRecommendationsDemo ??= [];
const cursorSchema = z.object({ time: z.string().datetime(), id: z.string().uuid() }).strict();
function cursorValue(cursor?: string) {
  if (!cursor) return undefined;
  if (cursor.length > 256 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error("invalid_cursor");
  try { return cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))); }
  catch { throw new Error("invalid_cursor"); }
}
function item(row: Row): CreatorRecommendation {
  return { id: row.id, ...recommendationInput({ ...row, linkKind: row.linkKind as CreatorRecommendationInput["linkKind"] }) };
}
function page(rows: Row[]): CreatorRecommendationPage {
  const last = rows[49];
  return { items: rows.slice(0, 50).map(item), nextCursor: rows.length > 50
    ? Buffer.from(JSON.stringify({ time: last.createdAt.toISOString(), id: last.id })).toString("base64url") : null };
}
function same(a: CreatorRecommendationInput, b: CreatorRecommendationInput) { return JSON.stringify(recommendationInput(a)) === JSON.stringify(recommendationInput(b)); }
function identity(creatorId: string, ownerId?: string) {
  if (!creatorId || creatorId === DEFAULT_CREATOR_ID || ownerId === "") throw new RecommendationAccessError();
}
function authorizeDemo(creatorId: string, ownerId?: string) {
  const tenant = listDemoCreatorTenants().find((t) => t.creator.id === creatorId);
  if (!canUseModules(tenant ?? null, ["product_recommendations"], "recommendations")
    || (ownerId !== undefined && tenant?.creator.ownerUserId !== ownerId)) throw new RecommendationAccessError();
}
async function authorize(tx: Tx, creatorId: string, ownerId?: string) {
  const [creator] = await tx.select({ id: creators.id, status: creators.status, ownerUserId: creators.ownerUserId })
    .from(creators).where(eq(creators.id, creatorId)).for("share");
  if (!creator || (ownerId !== undefined && creator.ownerUserId !== ownerId)) throw new RecommendationAccessError();
  const modules = await tx.select().from(creatorModules).where(and(eq(creatorModules.creatorId, creatorId), eq(creatorModules.moduleKey, "product_recommendations"))).for("share");
  if (!canUseModules({ creator, modules }, ["product_recommendations"], "recommendations")) throw new RecommendationAccessError();
}
function database() { const db = getDb(); if (!db) throw new Error("recommendation_storage_unavailable"); return db; }

/** Omitting ownerId is the public, published-only read. A supplied ownerId comes from the session. */
export async function listCreatorRecommendations(creatorId: string, ownerId?: string, cursor?: string) {
  identity(creatorId, ownerId); const before = cursorValue(cursor);
  if (isDemoMode) {
    authorizeDemo(creatorId, ownerId);
    return page(demo().filter((r) => r.creatorId === creatorId && (ownerId !== undefined || (r.isActive && r.moderationStatus === "approved")))
      .filter((r) => !before || r.createdAt.getTime() < Date.parse(before.time) || (r.createdAt.toISOString() === before.time && r.id < before.id))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)).slice(0, 51));
  }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId, ownerId);
    return page(await tx.select().from(productRecommendations).where(and(eq(productRecommendations.creatorId, creatorId),
      ownerId === undefined ? and(eq(productRecommendations.isActive, true), eq(productRecommendations.moderationStatus, "approved")) : undefined,
      before ? or(lt(productRecommendations.createdAt, new Date(before.time)), and(eq(productRecommendations.createdAt, new Date(before.time)), lt(productRecommendations.id, before.id))) : undefined))
      .orderBy(desc(productRecommendations.createdAt), desc(productRecommendations.id)).limit(51));
  });
}

export async function saveCreatorRecommendation(creatorId: string, ownerId: string, input: unknown, updating = false) {
  identity(creatorId, ownerId);
  const parsed = updating ? updateRecommendationSchema.parse(input) : createRecommendationSchema.parse(input);
  const expected = updating ? updateRecommendationSchema.parse(input).expected : undefined;
  function check(existing?: Row) {
    if (existing && existing.creatorId !== creatorId) throw new RecommendationAccessError();
    if (updating && !existing) throw new RecommendationAccessError();
    if (existing && !same(item(existing), parsed.item)
      && (!expected || !same(item(existing), expected))) throw new RecommendationConflictError();
  }
  if (isDemoMode) {
    authorizeDemo(creatorId, ownerId);
    const existing = demo().find((r) => r.id === parsed.id); check(existing);
    if (existing) { Object.assign(existing, parsed.item, { updatedAt: new Date() }); return item(existing); }
    const now = new Date();
    const created: Row = { ...parsed.item, id: parsed.id, creatorId, slug: `community-${parsed.id}`, moderationStatus: "approved", sortOrder: 0, createdAt: now, updatedAt: now };
    demo().push(created); return item(created);
  }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId, ownerId);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${parsed.id}, 215))`);
    const [existing] = await tx.select().from(productRecommendations).where(eq(productRecommendations.id, parsed.id)).for("update");
    check(existing);
    if (existing) {
      const [updated] = await tx.update(productRecommendations).set({ ...parsed.item, updatedAt: new Date() })
        .where(and(eq(productRecommendations.creatorId, creatorId), eq(productRecommendations.id, parsed.id))).returning();
      return item(updated);
    }
    const now = new Date();
    const [created] = await tx.insert(productRecommendations).values({ ...parsed.item, id: parsed.id, creatorId,
      slug: `community-${parsed.id}`, moderationStatus: "approved", sortOrder: 0, createdAt: now, updatedAt: now }).returning();
    return item(created);
  });
}
