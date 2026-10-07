import { ZodError } from "zod";

import { extractYoutubeVideoId, resolveYoutubeVideoMetadata } from "@/lib/video-suggestions/service";
import { BoostBalanceError, BoostUnavailableError } from "./community-boosts.server";
import { communityOwnerContext, communityReply as reply, communityViewerContext } from "./community-api";
import { communityVideoInputSchema } from "./videos";
import {
  CommunityVideoAccessError,
  CommunityVideoConflictError,
  boostCommunityVideo,
  createCommunityVideo,
  listOwnedCommunityVideos,
  updateCommunityVideoStatus,
  voteCommunityVideo,
} from "./videos.server";

const unavailable = "Vídeos indisponíveis para esta comunidade.";
const videosModule = { key: "video_suggestions", operation: "videos", unavailable } as const;

function failure(error: unknown) {
  if (error instanceof BoostUnavailableError || error instanceof BoostBalanceError) return reply({ ok: false, error: error.message }, 409);
  if (error instanceof CommunityVideoAccessError) return reply({ ok: false, error: unavailable }, 404);
  if (error instanceof CommunityVideoConflictError) return reply({ ok: false, error: error.message }, 409);
  if (error instanceof ZodError) return reply({ ok: false, error: error.issues[0]?.message ?? "Confira os dados do vídeo." }, 400);
  if (error instanceof SyntaxError) return reply({ ok: false, error: "Confira os dados do vídeo." }, 400);
  return reply({ ok: false, error: "Não foi possível acessar os vídeos agora. Tente novamente mais tarde." }, 503);
}

export async function suggestCommunityVideoRequest(request: Request, creatorSlug: string) {
  try {
    const context = await communityViewerContext(request, creatorSlug, videosModule);
    if ("response" in context) return context.response;
    const input = communityVideoInputSchema.parse(await request.json());
    if (!extractYoutubeVideoId(input.videoUrl)) return reply({ ok: false, error: "Cole um link válido de vídeo do YouTube." }, 400);
    let video;
    try { video = await resolveYoutubeVideoMetadata(input.videoUrl); }
    catch { return reply({ ok: false, error: "Não encontramos esse vídeo no YouTube. Confira se ele é público." }, 400); }
    return reply({ ok: true, data: await createCommunityVideo(context.creatorId, context.viewerId, { video, reason: input.reason }) }, 201);
  } catch (error) { return failure(error); }
}

export async function voteCommunityVideoRequest(request: Request, target: { creatorSlug: string; id: string }, vote: boolean) {
  try {
    const context = await communityViewerContext(request, target.creatorSlug, videosModule);
    if ("response" in context) return context.response;
    return reply({ ok: true, data: await voteCommunityVideo(context.creatorId, context.viewerId, target.id, vote) });
  } catch (error) { return failure(error); }
}

export async function ownerCommunityVideosRequest(request: Request, creatorId: string) {
  try {
    const context = await communityOwnerContext(request);
    if ("response" in context) return context.response;
    return reply({ ok: true, data: request.method === "GET"
      ? await listOwnedCommunityVideos(creatorId, context.ownerId)
      : await updateCommunityVideoStatus(creatorId, context.ownerId, await request.json()) });
  } catch (error) { return failure(error); }
}

/** Spends the viewer's community currency on a suggestion still in the vote. */
export async function boostVideoRequest(request: Request, target: { creatorSlug: string; id: string }) {
  try {
    const context = await communityViewerContext(request, target.creatorSlug, videosModule);
    if ("response" in context) return context.response;
    return reply({ ok: true, data: await boostCommunityVideo(context.creatorId, context.viewerId, target.id, await request.json()) });
  } catch (error) { return failure(error); }
}
