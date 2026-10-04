import { randomUUID } from "node:crypto";

import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { creatorModules, creators, users, videoSuggestionBoosts, videoSuggestions } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import type { YoutubeVideoMetadata } from "@/lib/video-suggestions/service";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import { communityVoteId } from "./community-votes";
import { canUseModules } from "./module-access";
import {
  communityVideoStatusSchema,
  MAX_OPEN_VIDEOS_PER_VIEWER,
  youtubeThumbnailUrl,
  type CommunityVideo,
  type CommunityVideoBoard,
  type CommunityVideoStatus,
} from "./videos";

/** Unknown community, missing module, wrong owner or unknown video: callers answer 404. */
export class CommunityVideoAccessError extends Error {}
/** The message is shown to the viewer as is. */
export class CommunityVideoConflictError extends Error {}

type Row = typeof videoSuggestions.$inferSelect;
type VoteRow = typeof videoSuggestionBoosts.$inferSelect;
type Tx = Parameters<Parameters<NonNullable<ReturnType<typeof getDb>>["transaction"]>[0]>[0];
declare global { var __communityVideosDemo: { videos: Row[]; votes: VoteRow[] } | undefined; }
const demo = () => globalThis.__communityVideosDemo ??= { videos: [], votes: [] };

const OPEN_LIMIT = 100;
const HISTORY_LIMIT = 30;

function identity(creatorId: string, viewerId?: string) {
  if (!creatorId || creatorId === DEFAULT_CREATOR_ID || viewerId === "") throw new CommunityVideoAccessError();
}

function authorizeDemo(creatorId: string, ownerId?: string) {
  const tenant = listDemoCreatorTenants().find((entry) => entry.creator.id === creatorId);
  if (!canUseModules(tenant ?? null, ["video_suggestions"], "videos")
    || (ownerId !== undefined && tenant?.creator.ownerUserId !== ownerId)) throw new CommunityVideoAccessError();
}

async function authorize(tx: Tx, creatorId: string, ownerId?: string) {
  const [creator] = await tx.select({ id: creators.id, status: creators.status, ownerUserId: creators.ownerUserId })
    .from(creators).where(eq(creators.id, creatorId)).for("share");
  if (!creator || (ownerId !== undefined && creator.ownerUserId !== ownerId)) throw new CommunityVideoAccessError();
  const modules = await tx.select({ moduleKey: creatorModules.moduleKey, status: creatorModules.status }).from(creatorModules)
    .where(and(eq(creatorModules.creatorId, creatorId), eq(creatorModules.moduleKey, "video_suggestions"))).for("share");
  if (!canUseModules({ creator, modules }, ["video_suggestions"], "videos")) throw new CommunityVideoAccessError();
}

function database() {
  const db = getDb();
  if (!db) throw new Error("community_video_storage_unavailable");
  return db;
}

function toVideo(row: Row, names: Map<string, string>, voted: Set<string>): CommunityVideo {
  return {
    id: row.id,
    title: row.title,
    channelName: row.creatorName,
    thumbnailUrl: row.thumbnailUrl,
    videoUrl: row.videoUrl,
    reason: row.reason,
    status: row.status as CommunityVideoStatus,
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

function demoBoard(creatorId: string, viewerId: string | undefined, includeRejected: boolean): CommunityVideoBoard {
  const rows = demo().videos.filter((row) => row.creatorId === creatorId);
  const voted = new Set(viewerId ? rows.filter((row) => demo().votes.some((vote) => vote.id === communityVoteId(row.id, viewerId))).map((row) => row.id) : []);
  const names = demoNames(rows);
  const pick = (status: CommunityVideoStatus, sort: (a: Row, b: Row) => number, limit: number) =>
    rows.filter((row) => row.status === status).sort(sort).slice(0, limit).map((row) => toVideo(row, names, voted));
  return { open: pick("open", byVotes, OPEN_LIMIT), reacted: pick("reacted", byUpdate, HISTORY_LIMIT), rejected: includeRejected ? pick("rejected", byUpdate, HISTORY_LIMIT) : [] };
}

async function readBoard(tx: Tx, creatorId: string, viewerId: string | undefined, includeRejected: boolean): Promise<CommunityVideoBoard> {
  const select = (status: CommunityVideoStatus, limit: number) => {
    const query = tx.select().from(videoSuggestions).where(and(eq(videoSuggestions.creatorId, creatorId), eq(videoSuggestions.status, status)));
    return (status === "open"
      ? query.orderBy(desc(videoSuggestions.totalVotes), asc(videoSuggestions.createdAt), asc(videoSuggestions.id))
      : query.orderBy(desc(videoSuggestions.updatedAt), desc(videoSuggestions.id))).limit(limit);
  };
  const [open, reacted, rejected] = await Promise.all([
    select("open", OPEN_LIMIT), select("reacted", HISTORY_LIMIT), includeRejected ? select("rejected", HISTORY_LIMIT) : Promise.resolve([]),
  ]);
  const rows = [...open, ...reacted, ...rejected];
  const viewerIds = [...new Set(rows.map((row) => row.viewerId))];
  const names = new Map(viewerIds.length
    ? (await tx.select({ id: users.id, name: users.youtubeDisplayName }).from(users).where(inArray(users.id, viewerIds))).map((user) => [user.id, user.name])
    : []);
  const voteIds = viewerId ? rows.map((row) => communityVoteId(row.id, viewerId)) : [];
  const votes = voteIds.length
    ? await tx.select({ suggestionId: videoSuggestionBoosts.suggestionId }).from(videoSuggestionBoosts)
      .where(and(eq(videoSuggestionBoosts.creatorId, creatorId), inArray(videoSuggestionBoosts.id, voteIds)))
    : [];
  const voted = new Set(votes.map((vote) => vote.suggestionId));
  const map = (list: Row[]) => list.map((row) => toVideo(row, names, voted));
  return { open: map(open), reacted: map(reacted), rejected: map(rejected) };
}

/** Omitting viewerId is the anonymous read. A supplied viewerId comes from the session. */
export async function listCommunityVideos(creatorId: string, viewerId?: string) {
  identity(creatorId, viewerId);
  if (isDemoMode) { authorizeDemo(creatorId); return demoBoard(creatorId, viewerId, false); }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId);
    return readBoard(tx, creatorId, viewerId, false);
  }, { isolationLevel: "repeatable read" });
}

/** ownerId must come from the authenticated session. */
export async function listOwnedCommunityVideos(creatorId: string, ownerId: string) {
  identity(creatorId, ownerId);
  if (!ownerId) throw new CommunityVideoAccessError();
  if (isDemoMode) { authorizeDemo(creatorId, ownerId); return demoBoard(creatorId, undefined, true); }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId, ownerId);
    return readBoard(tx, creatorId, undefined, true);
  }, { isolationLevel: "repeatable read" });
}

const duplicateMessage = (status: string) =>
  status === "reacted" ? "Esse vídeo já ganhou reação." : "Esse vídeo já está na fila. Deixe seu voto nele.";
const limitMessage = `Você já tem ${MAX_OPEN_VIDEOS_PER_VIEWER} vídeos na fila. Sugira outro quando um deles ganhar reação.`;

/**
 * viewerId comes from the session; the video was resolved on the server from its
 * YouTube link. The suggestion starts with the viewer's own vote.
 */
export async function createCommunityVideo(creatorId: string, viewerId: string, input: { video: YoutubeVideoMetadata; reason: string | null }) {
  identity(creatorId, viewerId);
  if (!viewerId) throw new CommunityVideoAccessError();
  const { video, reason } = input;
  const now = new Date();
  const row = (id: string): Row => ({
    id, creatorId, viewerId, youtubeVideoId: video.videoId, title: video.title.slice(0, 255), creatorName: video.creatorName.slice(0, 255),
    thumbnailUrl: youtubeThumbnailUrl(video.videoId), videoUrl: video.videoUrl, reason, status: "open", totalVotes: 1, createdAt: now, updatedAt: now,
  });
  if (isDemoMode) {
    authorizeDemo(creatorId);
    const store = demo();
    const existing = store.videos.find((entry) => entry.creatorId === creatorId && entry.youtubeVideoId === video.videoId && entry.status !== "rejected");
    if (existing) throw new CommunityVideoConflictError(duplicateMessage(existing.status));
    if (store.videos.filter((entry) => entry.creatorId === creatorId && entry.viewerId === viewerId && entry.status === "open").length >= MAX_OPEN_VIDEOS_PER_VIEWER)
      throw new CommunityVideoConflictError(limitMessage);
    const created = row(randomUUID());
    store.videos.unshift(created);
    store.votes.unshift({ id: communityVoteId(created.id, viewerId), creatorId, suggestionId: created.id, viewerId, amount: 1, createdAt: now });
    return toVideo(created, demoNames([created]), new Set([created.id]));
  }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId);
    // Serializes suggestions per community, so duplicate and limit checks hold under concurrency.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([creatorId, "videos"])}, 248))`);
    const [existing] = await tx.select({ status: videoSuggestions.status }).from(videoSuggestions)
      .where(and(eq(videoSuggestions.creatorId, creatorId), eq(videoSuggestions.youtubeVideoId, video.videoId), inArray(videoSuggestions.status, ["open", "reacted"])))
      .limit(1);
    if (existing) throw new CommunityVideoConflictError(duplicateMessage(existing.status));
    const [{ open }] = await tx.select({ open: count() }).from(videoSuggestions)
      .where(and(eq(videoSuggestions.creatorId, creatorId), eq(videoSuggestions.viewerId, viewerId), eq(videoSuggestions.status, "open")));
    if (open >= MAX_OPEN_VIDEOS_PER_VIEWER) throw new CommunityVideoConflictError(limitMessage);
    const [created] = await tx.insert(videoSuggestions).values(row(randomUUID())).returning();
    await tx.insert(videoSuggestionBoosts).values({ id: communityVoteId(created.id, viewerId), creatorId, suggestionId: created.id, viewerId, amount: 1, createdAt: now });
    const [user] = await tx.select({ name: users.youtubeDisplayName }).from(users).where(eq(users.id, viewerId));
    return toVideo(created, new Map(user ? [[viewerId, user.name]] : []), new Set([created.id]));
  });
}

/** Adds or removes the viewer's free vote. Repeating either is harmless. */
export async function voteCommunityVideo(creatorId: string, viewerId: string, suggestionId: string, vote: boolean) {
  identity(creatorId, viewerId);
  if (!viewerId || !/^[0-9a-f-]{36}$/i.test(suggestionId)) throw new CommunityVideoAccessError();
  const voteId = communityVoteId(suggestionId, viewerId);
  if (isDemoMode) {
    authorizeDemo(creatorId);
    const store = demo();
    const row = store.videos.find((entry) => entry.creatorId === creatorId && entry.id === suggestionId);
    if (!row) throw new CommunityVideoAccessError();
    if (row.status !== "open") throw new CommunityVideoConflictError("Esse vídeo saiu da fila.");
    const index = store.votes.findIndex((entry) => entry.id === voteId);
    if (vote && index < 0) {
      store.votes.unshift({ id: voteId, creatorId, suggestionId, viewerId, amount: 1, createdAt: new Date() });
      row.totalVotes += 1;
    } else if (!vote && index >= 0) {
      store.votes.splice(index, 1);
      row.totalVotes = Math.max(0, row.totalVotes - 1);
    }
    return toVideo(row, demoNames([row]), new Set(vote ? [row.id] : []));
  }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId);
    const [row] = await tx.select().from(videoSuggestions)
      .where(and(eq(videoSuggestions.creatorId, creatorId), eq(videoSuggestions.id, suggestionId))).for("update");
    if (!row) throw new CommunityVideoAccessError();
    if (row.status !== "open") throw new CommunityVideoConflictError("Esse vídeo saiu da fila.");
    const changed = vote
      ? await tx.insert(videoSuggestionBoosts).values({ id: voteId, creatorId, suggestionId, viewerId, amount: 1 }).onConflictDoNothing().returning({ id: videoSuggestionBoosts.id })
      : await tx.delete(videoSuggestionBoosts).where(and(eq(videoSuggestionBoosts.creatorId, creatorId), eq(videoSuggestionBoosts.id, voteId))).returning({ id: videoSuggestionBoosts.id });
    let updated = row;
    if (changed.length) {
      [updated] = await tx.update(videoSuggestions)
        .set({ totalVotes: sql`greatest(${videoSuggestions.totalVotes} + ${vote ? 1 : -1}, 0)` })
        .where(and(eq(videoSuggestions.creatorId, creatorId), eq(videoSuggestions.id, suggestionId))).returning();
    }
    const [user] = await tx.select({ name: users.youtubeDisplayName }).from(users).where(eq(users.id, row.viewerId));
    return toVideo(updated, new Map(user ? [[row.viewerId, user.name]] : []), new Set(vote ? [row.id] : []));
  });
}

/** ownerId must come from the authenticated session. Votes are kept when a video leaves the queue. */
export async function updateCommunityVideoStatus(creatorId: string, ownerId: string, input: unknown) {
  identity(creatorId, ownerId);
  if (!ownerId) throw new CommunityVideoAccessError();
  const { suggestionId, status } = communityVideoStatusSchema.parse(input);
  if (isDemoMode) {
    authorizeDemo(creatorId, ownerId);
    const row = demo().videos.find((entry) => entry.creatorId === creatorId && entry.id === suggestionId);
    if (!row) throw new CommunityVideoAccessError();
    row.status = status;
    row.updatedAt = new Date();
    return toVideo(row, demoNames([row]), new Set());
  }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId, ownerId);
    const [row] = await tx.update(videoSuggestions).set({ status, updatedAt: new Date() })
      .where(and(eq(videoSuggestions.creatorId, creatorId), eq(videoSuggestions.id, suggestionId))).returning();
    if (!row) throw new CommunityVideoAccessError();
    const [user] = await tx.select({ name: users.youtubeDisplayName }).from(users).where(eq(users.id, row.viewerId));
    return toVideo(row, new Map(user ? [[row.viewerId, user.name]] : []), new Set());
  });
}
