import { randomUUID } from "node:crypto";

import { and, asc, count, desc, eq, inArray, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { creatorModules, creators, gameSuggestionBoosts, gameSuggestions, users } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import type { buildHowLongToBeatColumns } from "@/lib/howlongtobeat-columns";
import { slugify } from "@/lib/utils";
import { communityVoteId } from "./community-votes";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import {
  communityGameStatusSchema,
  MAX_OPEN_GAMES_PER_VIEWER,
  type CommunityGame,
  type CommunityGameBoard,
  type CommunityGameStatus,
} from "./games";
import { canUseModules } from "./module-access";

/** Unknown community, missing module, wrong owner or unknown game: callers answer 404. */
export class CommunityGameAccessError extends Error {}
/** The message is shown to the viewer as is. */
export class CommunityGameConflictError extends Error {}

/** Resolved on the server: from IGDB when the viewer picked a search result, otherwise only the typed name. */
export type CommunityGameDetails = {
  igdbId: number | null;
  name: string;
  coverImageUrl: string | null;
  releaseYear: number | null;
  platforms: string[];
  genres: string[];
};

type Row = typeof gameSuggestions.$inferSelect;
type VoteRow = typeof gameSuggestionBoosts.$inferSelect;
type HowLongToBeatColumns = ReturnType<typeof buildHowLongToBeatColumns>;
type Tx = Parameters<Parameters<NonNullable<ReturnType<typeof getDb>>["transaction"]>[0]>[0];
declare global { var __communityGamesDemo: { rows: Row[]; votes: VoteRow[] } | undefined; }
const demo = () => globalThis.__communityGamesDemo ??= { rows: [], votes: [] };

const LIST_LIMIT = 100;
const HISTORY_LIMIT = 30;
/** Rejected games can be suggested again; the others stay unique per community. */
const LIVE_STATUSES: CommunityGameStatus[] = ["open", "accepted", "played"];

function identity(creatorId: string, viewerId?: string) {
  if (!creatorId || creatorId === DEFAULT_CREATOR_ID || viewerId === "") throw new CommunityGameAccessError();
}

function authorizeDemo(creatorId: string, ownerId?: string) {
  const tenant = listDemoCreatorTenants().find((entry) => entry.creator.id === creatorId);
  if (!canUseModules(tenant ?? null, ["game_suggestions"], "games")
    || (ownerId !== undefined && tenant?.creator.ownerUserId !== ownerId)) throw new CommunityGameAccessError();
}

async function authorize(tx: Tx, creatorId: string, ownerId?: string) {
  const [creator] = await tx.select({ id: creators.id, status: creators.status, ownerUserId: creators.ownerUserId })
    .from(creators).where(eq(creators.id, creatorId)).for("share");
  if (!creator || (ownerId !== undefined && creator.ownerUserId !== ownerId)) throw new CommunityGameAccessError();
  const modules = await tx.select({ moduleKey: creatorModules.moduleKey, status: creatorModules.status }).from(creatorModules)
    .where(and(eq(creatorModules.creatorId, creatorId), eq(creatorModules.moduleKey, "game_suggestions"))).for("share");
  if (!canUseModules({ creator, modules }, ["game_suggestions"], "games")) throw new CommunityGameAccessError();
}

function database() {
  const db = getDb();
  if (!db) throw new Error("community_game_storage_unavailable");
  return db;
}

const stringList = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);

function toGame(row: Row, names: Map<string, string>, voted: Set<string>): CommunityGame {
  return {
    id: row.id,
    name: row.canonicalName ?? row.name,
    coverImageUrl: row.coverImageUrl,
    releaseYear: row.releaseYear,
    platforms: stringList(row.platforms),
    genres: stringList(row.genres),
    mainStoryMinutes: row.hltbMainStoryMinutes,
    reason: row.description,
    status: row.status as CommunityGameStatus,
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

function demoBoard(creatorId: string, viewerId: string | undefined, includeRejected: boolean): CommunityGameBoard {
  const rows = demo().rows.filter((row) => row.creatorId === creatorId);
  const voted = new Set(viewerId ? rows.filter((row) => demo().votes.some((vote) => vote.id === communityVoteId(row.id, viewerId))).map((row) => row.id) : []);
  const names = demoNames(rows);
  const pick = (status: CommunityGameStatus, sort: (a: Row, b: Row) => number, limit: number) =>
    rows.filter((row) => row.status === status).sort(sort).slice(0, limit).map((row) => toGame(row, names, voted));
  return {
    accepted: pick("accepted", byVotes, LIST_LIMIT), open: pick("open", byVotes, LIST_LIMIT),
    played: pick("played", byUpdate, HISTORY_LIMIT), rejected: includeRejected ? pick("rejected", byUpdate, HISTORY_LIMIT) : [],
  };
}

async function readBoard(tx: Tx, creatorId: string, viewerId: string | undefined, includeRejected: boolean): Promise<CommunityGameBoard> {
  const select = (status: CommunityGameStatus, limit: number) => {
    const query = tx.select().from(gameSuggestions).where(and(eq(gameSuggestions.creatorId, creatorId), eq(gameSuggestions.status, status)));
    return (status === "open" || status === "accepted"
      ? query.orderBy(desc(gameSuggestions.totalVotes), asc(gameSuggestions.createdAt), asc(gameSuggestions.id))
      : query.orderBy(desc(gameSuggestions.updatedAt), desc(gameSuggestions.id))).limit(limit);
  };
  const [accepted, open, played, rejected] = await Promise.all([
    select("accepted", LIST_LIMIT), select("open", LIST_LIMIT), select("played", HISTORY_LIMIT),
    includeRejected ? select("rejected", HISTORY_LIMIT) : Promise.resolve([]),
  ]);
  const rows = [...accepted, ...open, ...played, ...rejected];
  const viewerIds = [...new Set(rows.map((row) => row.viewerId))];
  const names = new Map(viewerIds.length
    ? (await tx.select({ id: users.id, name: users.youtubeDisplayName }).from(users).where(inArray(users.id, viewerIds))).map((user) => [user.id, user.name])
    : []);
  const voteIds = viewerId ? open.map((row) => communityVoteId(row.id, viewerId)) : [];
  const votes = voteIds.length
    ? await tx.select({ suggestionId: gameSuggestionBoosts.suggestionId }).from(gameSuggestionBoosts)
      .where(and(eq(gameSuggestionBoosts.creatorId, creatorId), inArray(gameSuggestionBoosts.id, voteIds)))
    : [];
  const voted = new Set(votes.map((vote) => vote.suggestionId));
  const map = (list: Row[]) => list.map((row) => toGame(row, names, voted));
  return { accepted: map(accepted), open: map(open), played: map(played), rejected: map(rejected) };
}

async function nameOf(tx: Tx, viewerId: string) {
  const [user] = await tx.select({ name: users.youtubeDisplayName }).from(users).where(eq(users.id, viewerId));
  return new Map(user ? [[viewerId, user.name]] : []);
}

/** Omitting viewerId is the anonymous read. A supplied viewerId comes from the session. */
export async function listCommunityGames(creatorId: string, viewerId?: string) {
  identity(creatorId, viewerId);
  if (isDemoMode) { authorizeDemo(creatorId); return demoBoard(creatorId, viewerId, false); }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId);
    return readBoard(tx, creatorId, viewerId, false);
  }, { isolationLevel: "repeatable read" });
}

/** ownerId must come from the authenticated session. */
export async function listOwnedCommunityGames(creatorId: string, ownerId: string) {
  identity(creatorId, ownerId);
  if (!ownerId) throw new CommunityGameAccessError();
  if (isDemoMode) { authorizeDemo(creatorId, ownerId); return demoBoard(creatorId, undefined, true); }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId, ownerId);
    return readBoard(tx, creatorId, undefined, true);
  }, { isolationLevel: "repeatable read" });
}

const duplicateMessage = (status: string) => status === "played" ? "Esse jogo já foi jogado."
  : status === "accepted" ? "Esse jogo já está na lista para jogar." : "Esse jogo já foi sugerido. Deixe seu voto nele.";
const limitMessage = `Você já tem ${MAX_OPEN_GAMES_PER_VIEWER} jogos em votação. Sugira outro quando um deles sair da votação.`;

/**
 * viewerId comes from the session; details and play time were resolved on the
 * server. The suggestion starts with the viewer's own vote.
 */
export async function suggestCommunityGame(creatorId: string, viewerId: string, input: {
  details: CommunityGameDetails;
  reason: string | null;
  howLongToBeat: HowLongToBeatColumns | null;
}) {
  identity(creatorId, viewerId);
  if (!viewerId) throw new CommunityGameAccessError();
  const { details, reason, howLongToBeat } = input;
  const slug = slugify(details.name).slice(0, 160) || "jogo";
  const now = new Date();
  const values = {
    creatorId, viewerId, slug, name: details.name.slice(0, 255), description: reason, igdbId: details.igdbId,
    canonicalName: details.igdbId ? details.name.slice(0, 255) : null, coverImageUrl: details.coverImageUrl, releaseYear: details.releaseYear,
    platforms: details.platforms.slice(0, 4), genres: details.genres.slice(0, 3), ...(howLongToBeat ?? {}),
    status: "open", totalVotes: 1, createdAt: now, updatedAt: now,
  };
  const sameGame = (row: { slug: string; igdbId: number | null }) => row.slug === slug || (details.igdbId !== null && row.igdbId === details.igdbId);
  if (isDemoMode) {
    authorizeDemo(creatorId);
    const store = demo();
    const existing = store.rows.find((row) => row.creatorId === creatorId && sameGame(row) && LIVE_STATUSES.includes(row.status as CommunityGameStatus));
    if (existing) throw new CommunityGameConflictError(duplicateMessage(existing.status));
    if (store.rows.filter((row) => row.creatorId === creatorId && row.viewerId === viewerId && row.status === "open").length >= MAX_OPEN_GAMES_PER_VIEWER)
      throw new CommunityGameConflictError(limitMessage);
    const created = { ...demoRowDefaults(), ...values, id: randomUUID() } as Row;
    store.rows.unshift(created);
    store.votes.unshift({ id: communityVoteId(created.id, viewerId), creatorId, suggestionId: created.id, viewerId, amount: 1, createdAt: now });
    return toGame(created, demoNames([created]), new Set([created.id]));
  }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId);
    // Serializes suggestions per community, so duplicate and limit checks hold under concurrency.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([creatorId, "games"])}, 248))`);
    const [existing] = await tx.select({ status: gameSuggestions.status }).from(gameSuggestions)
      .where(and(eq(gameSuggestions.creatorId, creatorId), inArray(gameSuggestions.status, LIVE_STATUSES),
        details.igdbId !== null ? or(eq(gameSuggestions.slug, slug), eq(gameSuggestions.igdbId, details.igdbId)) : eq(gameSuggestions.slug, slug)))
      .limit(1);
    if (existing) throw new CommunityGameConflictError(duplicateMessage(existing.status));
    const [{ open }] = await tx.select({ open: count() }).from(gameSuggestions)
      .where(and(eq(gameSuggestions.creatorId, creatorId), eq(gameSuggestions.viewerId, viewerId), eq(gameSuggestions.status, "open")));
    if (open >= MAX_OPEN_GAMES_PER_VIEWER) throw new CommunityGameConflictError(limitMessage);
    const [created] = await tx.insert(gameSuggestions).values({ ...values, id: randomUUID() }).returning();
    await tx.insert(gameSuggestionBoosts).values({ id: communityVoteId(created.id, viewerId), creatorId, suggestionId: created.id, viewerId, amount: 1, createdAt: now });
    return toGame(created, await nameOf(tx, viewerId), new Set([created.id]));
  });
}

function demoRowDefaults(): Partial<Row> {
  return {
    description: null, linkUrl: null, igdbId: null, canonicalName: null, coverImageUrl: null, releaseYear: null, platforms: [], genres: [],
    hltbId: null, hltbName: null, hltbMainStoryMinutes: null, hltbMainExtraMinutes: null, hltbCompletionistMinutes: null, hltbSimilarity: null,
    hltbFetchedAt: null, psPlusAvailable: false, steamIsFree: false,
  };
}

/** Adds or removes the viewer's free vote on a game in the vote. Repeating either is harmless. */
export async function voteCommunityGame(creatorId: string, viewerId: string, suggestionId: string, vote: boolean) {
  identity(creatorId, viewerId);
  if (!viewerId || !/^[0-9a-f-]{36}$/i.test(suggestionId)) throw new CommunityGameAccessError();
  const voteId = communityVoteId(suggestionId, viewerId);
  if (isDemoMode) {
    authorizeDemo(creatorId);
    const store = demo();
    const row = store.rows.find((entry) => entry.creatorId === creatorId && entry.id === suggestionId);
    if (!row) throw new CommunityGameAccessError();
    if (row.status !== "open") throw new CommunityGameConflictError("Esse jogo não está mais em votação.");
    const index = store.votes.findIndex((entry) => entry.id === voteId);
    if (vote && index < 0) {
      store.votes.unshift({ id: voteId, creatorId, suggestionId, viewerId, amount: 1, createdAt: new Date() });
      row.totalVotes += 1;
    } else if (!vote && index >= 0) {
      store.votes.splice(index, 1);
      row.totalVotes = Math.max(0, row.totalVotes - 1);
    }
    return toGame(row, demoNames([row]), new Set(vote ? [row.id] : []));
  }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId);
    const [row] = await tx.select().from(gameSuggestions)
      .where(and(eq(gameSuggestions.creatorId, creatorId), eq(gameSuggestions.id, suggestionId))).for("update");
    if (!row) throw new CommunityGameAccessError();
    if (row.status !== "open") throw new CommunityGameConflictError("Esse jogo não está mais em votação.");
    const changed = vote
      ? await tx.insert(gameSuggestionBoosts).values({ id: voteId, creatorId, suggestionId, viewerId, amount: 1 }).onConflictDoNothing().returning({ id: gameSuggestionBoosts.id })
      : await tx.delete(gameSuggestionBoosts).where(and(eq(gameSuggestionBoosts.creatorId, creatorId), eq(gameSuggestionBoosts.id, voteId))).returning({ id: gameSuggestionBoosts.id });
    let updated = row;
    if (changed.length) {
      [updated] = await tx.update(gameSuggestions)
        .set({ totalVotes: sql`greatest(${gameSuggestions.totalVotes} + ${vote ? 1 : -1}, 0)` })
        .where(and(eq(gameSuggestions.creatorId, creatorId), eq(gameSuggestions.id, suggestionId))).returning();
    }
    return toGame(updated, await nameOf(tx, row.viewerId), new Set(vote ? [row.id] : []));
  });
}

/** ownerId must come from the authenticated session. Votes are kept when a game leaves the vote. */
export async function updateCommunityGameStatus(creatorId: string, ownerId: string, input: unknown) {
  identity(creatorId, ownerId);
  if (!ownerId) throw new CommunityGameAccessError();
  const { suggestionId, status } = communityGameStatusSchema.parse(input);
  if (isDemoMode) {
    authorizeDemo(creatorId, ownerId);
    const row = demo().rows.find((entry) => entry.creatorId === creatorId && entry.id === suggestionId);
    if (!row) throw new CommunityGameAccessError();
    row.status = status;
    row.updatedAt = new Date();
    return toGame(row, demoNames([row]), new Set());
  }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId, ownerId);
    const [row] = await tx.update(gameSuggestions).set({ status, updatedAt: new Date() })
      .where(and(eq(gameSuggestions.creatorId, creatorId), eq(gameSuggestions.id, suggestionId))).returning();
    if (!row) throw new CommunityGameAccessError();
    return toGame(row, await nameOf(tx, row.viewerId), new Set());
  });
}
