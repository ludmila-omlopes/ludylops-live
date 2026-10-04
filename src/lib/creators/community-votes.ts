import { createHash } from "node:crypto";

/**
 * Free votes share each suggestion module's boost table with a deterministic ID,
 * so the primary key allows one vote per viewer and suggestion without a new
 * table. Paid boosts use random IDs and are never mistaken for a vote.
 */
export function communityVoteId(suggestionId: string, viewerId: string) {
  return `vote_${createHash("sha256").update(JSON.stringify([suggestionId, viewerId])).digest("base64url")}`;
}
