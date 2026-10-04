import { randomUUID } from "node:crypto";

import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { creatorModules, creators, creatorSuggestionBoosts, creatorSuggestions, users } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import { slugify } from "@/lib/utils";
import { communityVoteId } from "./community-votes";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import {
  communityInspirationInputSchema,
  communityInspirationStatusSchema,
  MAX_OPEN_INSPIRATIONS_PER_VIEWER,
  normalizeInspirationLink,
  type CommunityInspiration,
  type CommunityInspirationBoard,
  type CommunityInspirationPlatform,
  type CommunityInspirationStatus,
} from "./inspirations";
import { canUseModules } from "./module-access";

/** Unknown community, missing module, wrong owner or unknown creator: callers answer 404. */
export class CommunityInspirationAccessError extends Error {}
/** The message is shown to the viewer as is. */
export class CommunityInspirationConflictError extends Error {}

type Row = typeof creatorSuggestions.$inferSelect;
type VoteRow = typeof creatorSuggestionBoosts.$inferSelect;
type Tx = Parameters<Parameters<NonNullable<ReturnType<typeof getDb>>["transaction"]>[0]>[0];
declare global { var __communityInspirationsDemo: { rows: Row[]; votes: VoteRow[] } | undefined; }
const demo = () => globalThis.__communityInspirationsDemo ??= { rows: [], votes: [] };

const LIST_LIMIT = 100;
const REJECTED_LIMIT = 30;
/** Rejected creators can be suggested again; the others stay unique per community. */
const LIVE_STATUSES: CommunityInspirationStatus[] = ["open", "featured"];

function identity(creatorId: string, viewerId?: string) {
  if (!creatorId || creatorId === DEFAULT_CREATOR_ID || viewerId === "") throw new CommunityInspirationAccessError();
}

function authorizeDemo(creatorId: string, ownerId?: string) {
  const tenant = listDemoCreatorTenants().find((entry) => entry.creator.id === creatorId);
  if (!canUseModules(tenant ?? null, ["creator_suggestions"], "inspirations")
    || (ownerId !== undefined && tenant?.creator.ownerUserId !== ownerId)) throw new CommunityInspirationAccessError();
}

async function authorize(tx: Tx, creatorId: string, ownerId?: string) {
  const [creator] = await tx.select({ id: creators.id, status: creators.status, ownerUserId: creators.ownerUserId })
    .from(creators).where(eq(creators.id, creatorId)).for("share");
  if (!creator || (ownerId !== undefined && creator.ownerUserId !== ownerId)) throw new CommunityInspirationAccessError();
  const modules = await tx.select({ moduleKey: creatorModules.moduleKey, status: creatorModules.status }).from(creatorModules)
    .where(and(eq(creatorModules.creatorId, creatorId), eq(creatorModules.moduleKey, "creator_suggestions"))).for("share");
  if (!canUseModules({ creator, modules }, ["creator_suggestions"], "inspirations")) throw new CommunityInspirationAccessError();
}

function database() {
  const db = getDb();
  if (!db) throw new Error("community_inspiration_storage_unavailable");
  return db;
}

function toInspiration(row: Row, names: Map<string, string>, voted: Set<string>): CommunityInspiration {
  return {
    id: row.id,
    name: row.name,
    channelUrl: row.channelUrl,
    platform: row.platform as CommunityInspirationPlatform,
    reason: row.reason,
    status: row.status as CommunityInspirationStatus,
    votes: row.totalVotes,
    suggestedBy: names.get(row.viewerId) ?? "Alguém da comunidade",
    voted: voted.has(row.id),
    createdAt: row.createdAt.toISOString(),
  };
}

const byVotes = (a: Row, b: Row) => b.totalVotes - a.totalVotes || a.createdAt.getTime() - b.createdAt.getTime();
const byUpdate = (a: Row, b: Row) => b.updatedAt.getTime() - a.updatedAt.getTime();

function demoNames(rows: Row[]) {
  const viewers = globalThis.__lojaDemoStore?.viewers ?? [];
  return new Map(rows.map((row) => [row.viewerId, viewers.find((viewer) => viewer.id === row.viewerId)?.youtubeDisplayName ?? ""])
    .filter(([, name]) => name) as [string, string][]);
}

function demoBoard(creatorId: string, viewerId: string | undefined, includeRejected: boolean): CommunityInspirationBoard {
  const rows = demo().rows.filter((row) => row.creatorId === creatorId);
  const voted = new Set(viewerId ? rows.filter((row) => demo().votes.some((vote) => vote.id === communityVoteId(row.id, viewerId))).map((row) => row.id) : []);
  const names = demoNames(rows);
  const pick = (status: CommunityInspirationStatus, sort: (a: Row, b: Row) => number, limit: number) =>
    rows.filter((row) => row.status === status).sort(sort).slice(0, limit).map((row) => toInspiration(row, names, voted));
  return { featured: pick("featured", byUpdate, LIST_LIMIT), open: pick("open", byVotes, LIST_LIMIT), rejected: includeRejected ? pick("rejected", byUpdate, REJECTED_LIMIT) : [] };
}

async function readBoard(tx: Tx, creatorId: string, viewerId: string | undefined, includeRejected: boolean): Promise<CommunityInspirationBoard> {
  const select = (status: CommunityInspirationStatus, limit: number) => {
    const query = tx.select().from(creatorSuggestions).where(and(eq(creatorSuggestions.creatorId, creatorId), eq(creatorSuggestions.status, status)));
    return (status === "open"
      ? query.orderBy(desc(creatorSuggestions.totalVotes), asc(creatorSuggestions.createdAt), asc(creatorSuggestions.id))
      : query.orderBy(desc(creatorSuggestions.updatedAt), desc(creatorSuggestions.id))).limit(limit);
  };
  const [featured, open, rejected] = await Promise.all([
    select("featured", LIST_LIMIT), select("open", LIST_LIMIT), includeRejected ? select("rejected", REJECTED_LIMIT) : Promise.resolve([]),
  ]);
  const rows = [...featured, ...open, ...rejected];
  const viewerIds = [...new Set(rows.map((row) => row.viewerId))];
  const names = new Map(viewerIds.length
    ? (await tx.select({ id: users.id, name: users.youtubeDisplayName }).from(users).where(inArray(users.id, viewerIds))).map((user) => [user.id, user.name])
    : []);
  const voteIds = viewerId ? open.map((row) => communityVoteId(row.id, viewerId)) : [];
  const votes = voteIds.length
    ? await tx.select({ suggestionId: creatorSuggestionBoosts.suggestionId }).from(creatorSuggestionBoosts)
      .where(and(eq(creatorSuggestionBoosts.creatorId, creatorId), inArray(creatorSuggestionBoosts.id, voteIds)))
    : [];
  const voted = new Set(votes.map((vote) => vote.suggestionId));
  const map = (list: Row[]) => list.map((row) => toInspiration(row, names, voted));
  return { featured: map(featured), open: map(open), rejected: map(rejected) };
}

async function nameOf(tx: Tx, viewerId: string) {
  const [user] = await tx.select({ name: users.youtubeDisplayName }).from(users).where(eq(users.id, viewerId));
  return new Map(user ? [[viewerId, user.name]] : []);
}

/** Omitting viewerId is the anonymous read. A supplied viewerId comes from the session. */
export async function listCommunityInspirations(creatorId: string, viewerId?: string) {
  identity(creatorId, viewerId);
  if (isDemoMode) { authorizeDemo(creatorId); return demoBoard(creatorId, viewerId, false); }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId);
    return readBoard(tx, creatorId, viewerId, false);
  }, { isolationLevel: "repeatable read" });
}

/** ownerId must come from the authenticated session. */
export async function listOwnedCommunityInspirations(creatorId: string, ownerId: string) {
  identity(creatorId, ownerId);
  if (!ownerId) throw new CommunityInspirationAccessError();
  if (isDemoMode) { authorizeDemo(creatorId, ownerId); return demoBoard(creatorId, undefined, true); }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId, ownerId);
    return readBoard(tx, creatorId, undefined, true);
  }, { isolationLevel: "repeatable read" });
}

const duplicateMessage = (status: string) =>
  status === "featured" ? "Esse criador já está em destaque." : "Esse criador já foi indicado. Deixe seu voto nele.";
const limitMessage = `Você já tem ${MAX_OPEN_INSPIRATIONS_PER_VIEWER} indicações em votação. Indique outro criador quando uma delas sair da lista.`;

/**
 * A viewer's suggestion starts open with their own vote. The owner's own
 * addition goes straight to the featured list, without votes.
 */
async function addInspiration(creatorId: string, viewerId: string, input: unknown, asOwner: boolean) {
  identity(creatorId, viewerId);
  if (!viewerId) throw new CommunityInspirationAccessError();
  const parsed = communityInspirationInputSchema.parse(input);
  const link = normalizeInspirationLink(parsed.channelUrl)!;
  const slug = slugify(parsed.name).slice(0, 160) || "criador";
  const now = new Date();
  const status: CommunityInspirationStatus = asOwner ? "featured" : "open";
  const row = (id: string): Row => ({
    id, creatorId, viewerId, slug, name: parsed.name, channelUrl: link.url, platform: link.platform, category: null,
    reason: parsed.reason, status, totalVotes: asOwner ? 0 : 1, createdAt: now, updatedAt: now,
  });
  if (isDemoMode) {
    authorizeDemo(creatorId, asOwner ? viewerId : undefined);
    const store = demo();
    const existing = store.rows.find((entry) => entry.creatorId === creatorId && entry.channelUrl.toLowerCase() === link.url.toLowerCase()
      && LIVE_STATUSES.includes(entry.status as CommunityInspirationStatus));
    if (existing) throw new CommunityInspirationConflictError(duplicateMessage(existing.status));
    if (!asOwner && store.rows.filter((entry) => entry.creatorId === creatorId && entry.viewerId === viewerId && entry.status === "open").length >= MAX_OPEN_INSPIRATIONS_PER_VIEWER)
      throw new CommunityInspirationConflictError(limitMessage);
    const created = row(randomUUID());
    store.rows.unshift(created);
    if (!asOwner) store.votes.unshift({ id: communityVoteId(created.id, viewerId), creatorId, suggestionId: created.id, viewerId, amount: 1, createdAt: now });
    return toInspiration(created, demoNames([created]), new Set(asOwner ? [] : [created.id]));
  }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId, asOwner ? viewerId : undefined);
    // Serializes additions per community, so duplicate and limit checks hold under concurrency.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([creatorId, "inspirations"])}, 248))`);
    const [existing] = await tx.select({ status: creatorSuggestions.status }).from(creatorSuggestions)
      .where(and(eq(creatorSuggestions.creatorId, creatorId), sql`lower(${creatorSuggestions.channelUrl}) = ${link.url.toLowerCase()}`,
        inArray(creatorSuggestions.status, LIVE_STATUSES)))
      .limit(1);
    if (existing) throw new CommunityInspirationConflictError(duplicateMessage(existing.status));
    if (!asOwner) {
      const [{ open }] = await tx.select({ open: count() }).from(creatorSuggestions)
        .where(and(eq(creatorSuggestions.creatorId, creatorId), eq(creatorSuggestions.viewerId, viewerId), eq(creatorSuggestions.status, "open")));
      if (open >= MAX_OPEN_INSPIRATIONS_PER_VIEWER) throw new CommunityInspirationConflictError(limitMessage);
    }
    const [created] = await tx.insert(creatorSuggestions).values(row(randomUUID())).returning();
    if (!asOwner) {
      await tx.insert(creatorSuggestionBoosts).values({ id: communityVoteId(created.id, viewerId), creatorId, suggestionId: created.id, viewerId, amount: 1, createdAt: now });
    }
    return toInspiration(created, await nameOf(tx, viewerId), new Set(asOwner ? [] : [created.id]));
  });
}

/** viewerId comes from the session. */
export function suggestCommunityInspiration(creatorId: string, viewerId: string, input: unknown) {
  return addInspiration(creatorId, viewerId, input, false);
}

/** ownerId comes from the session; the creator goes straight to the featured list. */
export function featureNewCommunityInspiration(creatorId: string, ownerId: string, input: unknown) {
  return addInspiration(creatorId, ownerId, input, true);
}

/** Adds or removes the viewer's free vote on an open suggestion. Repeating either is harmless. */
export async function voteCommunityInspiration(creatorId: string, viewerId: string, suggestionId: string, vote: boolean) {
  identity(creatorId, viewerId);
  if (!viewerId || !/^[0-9a-f-]{36}$/i.test(suggestionId)) throw new CommunityInspirationAccessError();
  const voteId = communityVoteId(suggestionId, viewerId);
  if (isDemoMode) {
    authorizeDemo(creatorId);
    const store = demo();
    const row = store.rows.find((entry) => entry.creatorId === creatorId && entry.id === suggestionId);
    if (!row) throw new CommunityInspirationAccessError();
    if (row.status !== "open") throw new CommunityInspirationConflictError("Essa indicação não está mais em votação.");
    const index = store.votes.findIndex((entry) => entry.id === voteId);
    if (vote && index < 0) {
      store.votes.unshift({ id: voteId, creatorId, suggestionId, viewerId, amount: 1, createdAt: new Date() });
      row.totalVotes += 1;
    } else if (!vote && index >= 0) {
      store.votes.splice(index, 1);
      row.totalVotes = Math.max(0, row.totalVotes - 1);
    }
    return toInspiration(row, demoNames([row]), new Set(vote ? [row.id] : []));
  }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId);
    const [row] = await tx.select().from(creatorSuggestions)
      .where(and(eq(creatorSuggestions.creatorId, creatorId), eq(creatorSuggestions.id, suggestionId))).for("update");
    if (!row) throw new CommunityInspirationAccessError();
    if (row.status !== "open") throw new CommunityInspirationConflictError("Essa indicação não está mais em votação.");
    const changed = vote
      ? await tx.insert(creatorSuggestionBoosts).values({ id: voteId, creatorId, suggestionId, viewerId, amount: 1 }).onConflictDoNothing().returning({ id: creatorSuggestionBoosts.id })
      : await tx.delete(creatorSuggestionBoosts).where(and(eq(creatorSuggestionBoosts.creatorId, creatorId), eq(creatorSuggestionBoosts.id, voteId))).returning({ id: creatorSuggestionBoosts.id });
    let updated = row;
    if (changed.length) {
      [updated] = await tx.update(creatorSuggestions)
        .set({ totalVotes: sql`greatest(${creatorSuggestions.totalVotes} + ${vote ? 1 : -1}, 0)` })
        .where(and(eq(creatorSuggestions.creatorId, creatorId), eq(creatorSuggestions.id, suggestionId))).returning();
    }
    return toInspiration(updated, await nameOf(tx, row.viewerId), new Set(vote ? [row.id] : []));
  });
}

/** ownerId must come from the authenticated session. Votes are kept when a creator leaves the vote. */
export async function updateCommunityInspirationStatus(creatorId: string, ownerId: string, input: unknown) {
  identity(creatorId, ownerId);
  if (!ownerId) throw new CommunityInspirationAccessError();
  const { suggestionId, status } = communityInspirationStatusSchema.parse(input);
  if (isDemoMode) {
    authorizeDemo(creatorId, ownerId);
    const row = demo().rows.find((entry) => entry.creatorId === creatorId && entry.id === suggestionId);
    if (!row) throw new CommunityInspirationAccessError();
    row.status = status;
    row.updatedAt = new Date();
    return toInspiration(row, demoNames([row]), new Set());
  }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId, ownerId);
    const [row] = await tx.update(creatorSuggestions).set({ status, updatedAt: new Date() })
      .where(and(eq(creatorSuggestions.creatorId, creatorId), eq(creatorSuggestions.id, suggestionId))).returning();
    if (!row) throw new CommunityInspirationAccessError();
    return toInspiration(row, await nameOf(tx, row.viewerId), new Set());
  });
}
