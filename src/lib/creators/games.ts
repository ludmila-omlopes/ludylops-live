import { z } from "zod";

// Games the community suggests for the creator to play. Client-safe: the
// public page, the owner section and the APIs share these schemas and shapes.
export const COMMUNITY_GAME_STATUSES = ["open", "accepted", "played", "rejected"] as const;
export type CommunityGameStatus = (typeof COMMUNITY_GAME_STATUSES)[number];

/** Free suggestions need a limit; a viewer suggests again once one leaves the vote. */
export const MAX_OPEN_GAMES_PER_VIEWER = 3;

/** A game picked from the IGDB search sends its ID; the server reads name and cover from IGDB itself. */
export const communityGameInputSchema = z
  .object({
    igdbId: z.number().int().positive().optional(),
    name: z.string().trim().min(2, "Digite o nome do jogo.").max(120, "Use no máximo 120 caracteres."),
    reason: z.string().trim().max(500, "Use no máximo 500 caracteres.").optional().transform((value) => value || null),
  })
  .strict();

export const communityGameStatusSchema = z
  .object({
    suggestionId: z.string().uuid(),
    status: z.enum(COMMUNITY_GAME_STATUSES),
  })
  .strict();

export type CommunityGameSearchResult = {
  igdbId: number;
  name: string;
  releaseYear: number | null;
  coverImageUrl: string | null;
  platforms: string[];
  genres: string[];
};

export type CommunityGame = {
  id: string;
  name: string;
  coverImageUrl: string | null;
  releaseYear: number | null;
  platforms: string[];
  genres: string[];
  /** HowLongToBeat main story, when found. */
  mainStoryMinutes: number | null;
  reason: string | null;
  status: CommunityGameStatus;
  votes: number;
  suggestedBy: string;
  /** Whether the viewer reading the list already voted for it. */
  voted: boolean;
  createdAt: string;
};

export type CommunityGameBoard = {
  /** Picked by the creator to play next. */
  accepted: CommunityGame[];
  /** In the vote, most voted first. */
  open: CommunityGame[];
  /** Most recent first. */
  played: CommunityGame[];
  /** Only in the owner's board. */
  rejected: CommunityGame[];
};

export function formatPlayTime(minutes: number | null) {
  if (!minutes) return null;
  const hours = Math.round(minutes / 30) / 2;
  return hours < 1 ? "menos de 1 h de história" : `${hours.toLocaleString("pt-BR")} h de história`;
}

export function gameDetails(game: Pick<CommunityGame, "releaseYear" | "platforms" | "mainStoryMinutes">) {
  return [game.releaseYear ? String(game.releaseYear) : null, game.platforms.slice(0, 3).join(", ") || null, formatPlayTime(game.mainStoryMinutes)]
    .filter(Boolean).join(" · ");
}
