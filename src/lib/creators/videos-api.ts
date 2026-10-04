import { ZodError } from "zod";

import { isTrustedAppMutationRequest, requireApiSession } from "@/lib/api";
import { extractYoutubeVideoId, resolveYoutubeVideoMetadata } from "@/lib/video-suggestions/service";
import { canUseModules } from "./module-access";
import { getCreatorAreaBySlug } from "./service";
import { communityVideoInputSchema } from "./videos";
import {
  CommunityVideoAccessError,
  CommunityVideoConflictError,
  createCommunityVideo,
  listOwnedCommunityVideos,
  updateCommunityVideoStatus,
  voteCommunityVideo,
} from "./videos.server";

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const unavailable = () => reply({ ok: false, error: "Vídeos indisponíveis para esta comunidade." }, 404);
const signIn = () => reply({ ok: false, error: "Entre para sugerir e votar." }, 401);

function failure(error: unknown) {
  if (error instanceof CommunityVideoAccessError) return unavailable();
  if (error instanceof CommunityVideoConflictError) return reply({ ok: false, error: error.message }, 409);
  if (error instanceof ZodError) return reply({ ok: false, error: error.issues[0]?.message ?? "Confira os dados do vídeo." }, 400);
  if (error instanceof SyntaxError) return reply({ ok: false, error: "Confira os dados do vídeo." }, 400);
  return reply({ ok: false, error: "Não foi possível acessar os vídeos agora. Tente novamente mais tarde." }, 503);
}

type ViewerContext = { response: Response } | { creatorId: string; viewerId: string };

/** Module availability is checked before the session, so unavailable communities never reach storage. */
async function viewerContext(request: Request, creatorSlug: string): Promise<ViewerContext> {
  if (!isTrustedAppMutationRequest(request)) return { response: reply({ ok: false, error: "Origem inválida." }, 403) };
  const tenant = await getCreatorAreaBySlug(creatorSlug, { request });
  if (!tenant || !canUseModules(tenant, ["video_suggestions"], "videos")) return { response: unavailable() };
  const viewerId = (await requireApiSession())?.user?.activeViewerId;
  if (!viewerId) return { response: signIn() };
  return { creatorId: tenant.creator.id, viewerId };
}

export async function suggestCommunityVideoRequest(request: Request, creatorSlug: string) {
  try {
    const context = await viewerContext(request, creatorSlug);
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
    const context = await viewerContext(request, target.creatorSlug);
    if ("response" in context) return context.response;
    return reply({ ok: true, data: await voteCommunityVideo(context.creatorId, context.viewerId, target.id, vote) });
  } catch (error) { return failure(error); }
}

export async function ownerCommunityVideosRequest(request: Request, creatorId: string) {
  try {
    const mutation = request.method !== "GET";
    if (mutation && !isTrustedAppMutationRequest(request)) return reply({ ok: false, error: "Origem inválida." }, 403);
    const ownerId = (await requireApiSession())?.user?.activeViewerId;
    if (!ownerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    return reply({ ok: true, data: mutation
      ? await updateCommunityVideoStatus(creatorId, ownerId, await request.json())
      : await listOwnedCommunityVideos(creatorId, ownerId) });
  } catch (error) { return failure(error); }
}
