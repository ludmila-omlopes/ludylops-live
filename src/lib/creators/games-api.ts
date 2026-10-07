import { ZodError } from "zod";

import { resolveHowLongToBeatGame } from "@/lib/howlongtobeat";
import { buildHowLongToBeatColumns } from "@/lib/howlongtobeat-columns";
import { getIgdbGame, isIgdbConfigured, searchIgdbGames } from "@/lib/igdb";
import { CurrencySpendError, CurrencyUnavailableError } from "./community-boosts.server";
import { communityOwnerContext, communityReply as reply, communityViewerContext } from "./community-api";
import { communityGameInputSchema } from "./games";
import {
  CommunityGameAccessError,
  CommunityGameConflictError,
  boostCommunityGame,
  listOwnedCommunityGames,
  suggestCommunityGame,
  updateCommunityGameStatus,
  updateCommunityGameBoostSettings,
  voteCommunityGame,
  type CommunityGameDetails,
} from "./games.server";

const unavailable = "Jogos indisponíveis para esta comunidade.";
const gamesModule = { key: "game_suggestions", operation: "games", unavailable } as const;

function failure(error: unknown) {
  if (error instanceof CurrencyUnavailableError || error instanceof CurrencySpendError) return reply({ ok: false, error: error.message }, 409);
  if (error instanceof CommunityGameAccessError) return reply({ ok: false, error: unavailable }, 404);
  if (error instanceof CommunityGameConflictError) return reply({ ok: false, error: error.message }, 409);
  if (error instanceof ZodError) return reply({ ok: false, error: error.issues[0]?.message ?? "Confira os dados do jogo." }, 400);
  if (error instanceof SyntaxError) return reply({ ok: false, error: "Confira os dados do jogo." }, 400);
  return reply({ ok: false, error: "Não foi possível acessar os jogos agora. Tente novamente mais tarde." }, 503);
}

/** IGDB search for signed-in viewers of a community with games on. */
export async function searchCommunityGamesRequest(request: Request, creatorSlug: string) {
  try {
    const context = await communityViewerContext(request, creatorSlug, gamesModule);
    if ("response" in context) return context.response;
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) return reply({ ok: true, data: [] });
    if (!isIgdbConfigured()) return reply({ ok: false, error: "A busca de jogos está indisponível agora. Digite o nome do jogo." }, 503);
    return reply({ ok: true, data: await searchIgdbGames(query.slice(0, 120)) });
  } catch {
    return reply({ ok: false, error: "A busca de jogos está indisponível agora. Digite o nome do jogo." }, 503);
  }
}

/** Name, cover and platforms come from IGDB when the viewer picked a search result; never from the request body. */
async function resolveDetails(input: { igdbId?: number; name: string }): Promise<CommunityGameDetails | null> {
  const typed = { igdbId: null, name: input.name, coverImageUrl: null, releaseYear: null, platforms: [], genres: [] };
  if (!input.igdbId || !isIgdbConfigured()) return typed;
  const game = await getIgdbGame(input.igdbId);
  return game ? { ...game } : null;
}

export async function suggestCommunityGameRequest(request: Request, creatorSlug: string) {
  try {
    const context = await communityViewerContext(request, creatorSlug, gamesModule);
    if ("response" in context) return context.response;
    const input = communityGameInputSchema.parse(await request.json());
    let details: CommunityGameDetails | null;
    try { details = await resolveDetails(input); }
    catch { return reply({ ok: false, error: "Não foi possível consultar esse jogo agora. Tente novamente mais tarde." }, 503); }
    if (!details) return reply({ ok: false, error: "Não encontramos esse jogo. Busque de novo ou digite o nome." }, 400);
    // Play time is a nice extra; a slow or failed lookup never blocks the suggestion.
    const howLongToBeat = await resolveHowLongToBeatGame(details.name, details.platforms[0] ?? null)
      .then(buildHowLongToBeatColumns).catch(() => null);
    return reply({ ok: true, data: await suggestCommunityGame(context.creatorId, context.viewerId, { details, reason: input.reason, howLongToBeat }) }, 201);
  } catch (error) { return failure(error); }
}

export async function voteCommunityGameRequest(request: Request, target: { creatorSlug: string; id: string }, vote: boolean) {
  try {
    const context = await communityViewerContext(request, target.creatorSlug, gamesModule);
    if ("response" in context) return context.response;
    return reply({ ok: true, data: await voteCommunityGame(context.creatorId, context.viewerId, target.id, vote) });
  } catch (error) { return failure(error); }
}

export async function ownerCommunityGamesRequest(request: Request, creatorId: string) {
  try {
    const context = await communityOwnerContext(request);
    if ("response" in context) return context.response;
    if (request.method === "GET") return reply({ ok: true, data: await listOwnedCommunityGames(creatorId, context.ownerId) });
    const input = await request.json();
    const update = input && typeof input === "object" && "ownedGameMultiplier" in input
      ? updateCommunityGameBoostSettings : updateCommunityGameStatus;
    return reply({ ok: true, data: await update(creatorId, context.ownerId, input) });
  } catch (error) { return failure(error); }
}

/** Spends the viewer's community currency on a suggestion still in the vote. */
export async function boostGameRequest(request: Request, target: { creatorSlug: string; id: string }) {
  try {
    const context = await communityViewerContext(request, target.creatorSlug, gamesModule);
    if ("response" in context) return context.response;
    return reply({ ok: true, data: await boostCommunityGame(context.creatorId, context.viewerId, target.id, await request.json()) });
  } catch (error) { return failure(error); }
}
