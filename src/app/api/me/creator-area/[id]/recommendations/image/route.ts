import { requireApiSession, isTrustedAppMutationRequest } from "@/lib/api";
import { authorizeRecommendationOwner, RecommendationAccessError } from "@/lib/creators/recommendations.server";
import { imageReply, recommendationImageResponse } from "@/lib/recommendation-image-api";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedAppMutationRequest(request)) return imageReply({ ok: false, error: "Origem inválida." }, 403);
  const session = await requireApiSession();
  if (!session?.user?.activeViewerId) return imageReply({ ok: false, error: "Entre novamente para continuar." }, 401);
  const owner = session.user.activeViewerId, id = (await params).id;
  try { await authorizeRecommendationOwner(id, owner); }
  catch (error) {
    return imageReply({ ok: false, error: "Recomendações indisponíveis para esta comunidade." }, error instanceof RecommendationAccessError ? 404 : 503);
  }
  return recommendationImageResponse(request, `owner:${owner}`);
}
