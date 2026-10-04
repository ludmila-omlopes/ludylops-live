import { sql } from "drizzle-orm";

import type { EconomyTx } from "./economy-identity";
import { communityVoteId } from "./community-votes";

// When a viewer identity merges into another (a Google account linking its
// YouTube channel), every row the source left in the suggestion modules and in
// community ownership follows it, so deleting the source user never hits a
// foreign key. Covers Ludylops' rows and every community's.

/** Fixed table pairs; never built from input. */
const suggestionTables = [
  ["video_suggestion_boosts", "video_suggestions"],
  ["creator_suggestion_boosts", "creator_suggestions"],
  ["game_suggestion_boosts", "game_suggestions"],
] as const;

/**
 * Free votes have an ID derived from the voter, so they are re-keyed to the
 * target. When the target already voted for the same suggestion, the source's
 * vote is dropped and the total corrected: one person, one vote.
 */
export async function mergeCommunityIdentity(tx: EconomyTx, sourceId: string, targetId: string) {
  if (sourceId === targetId) return;
  for (const [boostTable, suggestionTable] of suggestionTables) {
    const boosts = sql.raw(boostTable);
    const suggestions = sql.raw(suggestionTable);
    const { rows: votes } = await tx.execute<{ id: string; suggestion_id: string }>(
      sql`select id, suggestion_id from ${boosts} where viewer_id = ${sourceId} and left(id, 5) = 'vote_' for update`,
    );
    for (const vote of votes) {
      const targetVote = communityVoteId(vote.suggestion_id, targetId);
      const { rows: moved } = await tx.execute(sql`update ${boosts} set id = ${targetVote}, viewer_id = ${targetId}
        where id = ${vote.id} and not exists (select 1 from ${boosts} where id = ${targetVote}) returning id`);
      if (!moved.length) {
        await tx.execute(sql`delete from ${boosts} where id = ${vote.id}`);
        await tx.execute(sql`update ${suggestions} set total_votes = greatest(total_votes - 1, 0) where id = ${vote.suggestion_id}`);
      }
    }
    await tx.execute(sql`update ${boosts} set viewer_id = ${targetId} where viewer_id = ${sourceId}`);
    await tx.execute(sql`update ${suggestions} set viewer_id = ${targetId} where viewer_id = ${sourceId}`);
  }
  await tx.execute(sql`update creators set owner_user_id = ${targetId}, updated_at = now() where owner_user_id = ${sourceId}`);
}

type DemoVote = { id: string; suggestionId: string; viewerId: string };
type DemoSuggestion = { id: string; viewerId: string; totalVotes: number };

function mergeDemoBoard(board: { votes: DemoVote[] } & ({ videos: DemoSuggestion[] } | { rows: DemoSuggestion[] }) | undefined, sourceId: string, targetId: string) {
  if (!board) return;
  const suggestions = "videos" in board ? board.videos : board.rows;
  for (const vote of board.votes.filter((entry) => entry.viewerId === sourceId)) {
    if (!vote.id.startsWith("vote_")) { vote.viewerId = targetId; continue; }
    const targetVote = communityVoteId(vote.suggestionId, targetId);
    if (board.votes.some((entry) => entry.id === targetVote)) {
      board.votes.splice(board.votes.indexOf(vote), 1);
      const suggestion = suggestions.find((entry) => entry.id === vote.suggestionId);
      if (suggestion) suggestion.totalVotes = Math.max(0, suggestion.totalVotes - 1);
    } else {
      vote.id = targetVote;
      vote.viewerId = targetId;
    }
  }
  for (const suggestion of suggestions) if (suggestion.viewerId === sourceId) suggestion.viewerId = targetId;
}

/** Demo counterpart for the in-memory community stores. */
export function mergeDemoCommunityIdentity(sourceId: string, targetId: string) {
  if (sourceId === targetId) return;
  mergeDemoBoard(globalThis.__communityVideosDemo, sourceId, targetId);
  mergeDemoBoard(globalThis.__communityInspirationsDemo, sourceId, targetId);
  mergeDemoBoard(globalThis.__communityGamesDemo, sourceId, targetId);
  for (const tenant of globalThis.__creatorTenantStore ?? []) {
    if (tenant.creator.ownerUserId === sourceId) tenant.creator.ownerUserId = targetId;
  }
}
