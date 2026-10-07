import { ZodError } from "zod";

import { actOnCommunityBet, CommunityBetAccessError, CommunityBetConflictError, createCommunityBet, listOwnedCommunityBets, placeCommunityBet } from "./bets.server";
import { CurrencySpendError, CurrencyUnavailableError } from "./community-boosts.server";
import { communityOwnerContext, communityReply as reply, communityViewerContext } from "./community-api";

const unavailable = "Apostas indisponíveis nesta comunidade.";
const betsModule = { key: "bets", operation: "bets", unavailable, signIn: "Entre para apostar." } as const;

function failure(error: unknown) {
  if (error instanceof CurrencyUnavailableError || error instanceof CurrencySpendError) return reply({ ok: false, error: error.message }, 409);
  if (error instanceof CommunityBetAccessError) return reply({ ok: false, error: unavailable }, 404);
  if (error instanceof CommunityBetConflictError) return reply({ ok: false, error: error.message }, 409);
  if (error instanceof ZodError) return reply({ ok: false, error: error.issues[0]?.message ?? "Confira os dados da aposta." }, 400);
  if (error instanceof SyntaxError) return reply({ ok: false, error: "Confira os dados da aposta." }, 400);
  return reply({ ok: false, error: "Não foi possível acessar as apostas agora. Tente novamente mais tarde." }, 503);
}

/** Places or adds to the signed-in viewer's bet with the community currency. */
export async function placeCommunityBetRequest(request: Request, target: { creatorSlug: string; id: string }) {
  try {
    const context = await communityViewerContext(request, target.creatorSlug, betsModule);
    if ("response" in context) return context.response;
    return reply({ ok: true, data: await placeCommunityBet(context.creatorId, context.viewerId, target.id, await request.json()) });
  } catch (error) { return failure(error); }
}

/** GET lists the owner's bets, POST opens a new one, PATCH locks, resolves or cancels. */
export async function ownerCommunityBetsRequest(request: Request, creatorId: string) {
  try {
    const context = await communityOwnerContext(request);
    if ("response" in context) return context.response;
    if (request.method === "GET") return reply({ ok: true, data: await listOwnedCommunityBets(creatorId, context.ownerId) });
    if (request.method === "POST") return reply({ ok: true, data: await createCommunityBet(creatorId, context.ownerId, await request.json()) }, 201);
    return reply({ ok: true, data: await actOnCommunityBet(creatorId, context.ownerId, await request.json()) });
  } catch (error) { return failure(error); }
}
