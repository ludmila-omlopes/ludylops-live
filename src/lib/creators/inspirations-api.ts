import { ZodError } from "zod";

import { CurrencySpendError, CurrencyUnavailableError } from "./community-boosts.server";
import { communityOwnerContext, communityReply as reply, communityViewerContext } from "./community-api";
import {
  CommunityInspirationAccessError,
  CommunityInspirationConflictError,
  boostCommunityInspiration,
  featureNewCommunityInspiration,
  listOwnedCommunityInspirations,
  suggestCommunityInspiration,
  updateCommunityInspirationStatus,
  voteCommunityInspiration,
} from "./inspirations.server";

const unavailable = "Inspirações indisponíveis para esta comunidade.";
const inspirationsModule = { key: "creator_suggestions", operation: "inspirations", unavailable } as const;

function failure(error: unknown) {
  if (error instanceof CurrencyUnavailableError || error instanceof CurrencySpendError) return reply({ ok: false, error: error.message }, 409);
  if (error instanceof CommunityInspirationAccessError) return reply({ ok: false, error: unavailable }, 404);
  if (error instanceof CommunityInspirationConflictError) return reply({ ok: false, error: error.message }, 409);
  if (error instanceof ZodError) return reply({ ok: false, error: error.issues[0]?.message ?? "Confira os dados da indicação." }, 400);
  if (error instanceof SyntaxError) return reply({ ok: false, error: "Confira os dados da indicação." }, 400);
  return reply({ ok: false, error: "Não foi possível acessar as inspirações agora. Tente novamente mais tarde." }, 503);
}

export async function suggestCommunityInspirationRequest(request: Request, creatorSlug: string) {
  try {
    const context = await communityViewerContext(request, creatorSlug, inspirationsModule);
    if ("response" in context) return context.response;
    return reply({ ok: true, data: await suggestCommunityInspiration(context.creatorId, context.viewerId, await request.json()) }, 201);
  } catch (error) { return failure(error); }
}

export async function voteCommunityInspirationRequest(request: Request, target: { creatorSlug: string; id: string }, vote: boolean) {
  try {
    const context = await communityViewerContext(request, target.creatorSlug, inspirationsModule);
    if ("response" in context) return context.response;
    return reply({ ok: true, data: await voteCommunityInspiration(context.creatorId, context.viewerId, target.id, vote) });
  } catch (error) { return failure(error); }
}

/** GET lists everything, POST features a new creator, PATCH moves one between lists. */
export async function ownerCommunityInspirationsRequest(request: Request, creatorId: string) {
  try {
    const context = await communityOwnerContext(request);
    if ("response" in context) return context.response;
    if (request.method === "GET") return reply({ ok: true, data: await listOwnedCommunityInspirations(creatorId, context.ownerId) });
    if (request.method === "POST") return reply({ ok: true, data: await featureNewCommunityInspiration(creatorId, context.ownerId, await request.json()) }, 201);
    return reply({ ok: true, data: await updateCommunityInspirationStatus(creatorId, context.ownerId, await request.json()) });
  } catch (error) { return failure(error); }
}

/** Spends the viewer's community currency on a suggestion still in the vote. */
export async function boostInspirationRequest(request: Request, target: { creatorSlug: string; id: string }) {
  try {
    const context = await communityViewerContext(request, target.creatorSlug, inspirationsModule);
    if ("response" in context) return context.response;
    return reply({ ok: true, data: await boostCommunityInspiration(context.creatorId, context.viewerId, target.id, await request.json()) });
  } catch (error) { return failure(error); }
}
