import { requireAdminApiSession, isTrustedAppMutationRequest } from "@/lib/api";
import { guardModuleRequest } from "@/lib/creators/module-access";
import { imageReply, recommendationImageResponse } from "@/lib/recommendation-image-api";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isTrustedAppMutationRequest(request)) return imageReply({ ok: false, error: "Origem inválida." }, 403);
  const session = await requireAdminApiSession();
  if (!session) return imageReply({ ok: false, error: "Acesso não autorizado." }, 403);
  const denial = await guardModuleRequest(request, ["product_recommendations"]);
  if (denial) return denial;
  if (!session.user?.email) return imageReply({ ok: false, error: "Acesso não autorizado." }, 403);
  return recommendationImageResponse(request, `admin:${session.user.email}`);
}
