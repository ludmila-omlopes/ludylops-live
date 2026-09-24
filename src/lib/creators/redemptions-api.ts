import { ZodError } from "zod";
import { isTrustedAppMutationRequest, requireApiSession } from "@/lib/api";
import { getCreatorAreaBySlug } from "./service";
import { RedemptionAccessError, RedemptionConflictError } from "./redemptions";
import { purchaseCreatorItem, saveCreatorCatalog } from "./redemptions.server";
export const redemptionReply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export function redemptionFailure(error: unknown) {
  if (error instanceof RedemptionAccessError) return redemptionReply({ ok: false, error: "Resgates indisponíveis para esta comunidade." }, 403);
  if (error instanceof RedemptionConflictError) return redemptionReply({ ok: false, error: error.message }, 409);
  if (error instanceof ZodError || error instanceof SyntaxError) return redemptionReply({ ok: false, error: "Confira os dados do resgate." }, 400);
  return redemptionReply({ ok: false, error: "Não foi possível acessar os resgates agora. Tente novamente mais tarde." }, 503);
}
export async function creatorRedemptionRequest(request: Request, target: { id: string } | { slug: string }) {
  try {
    if (!isTrustedAppMutationRequest(request)) return redemptionReply({ ok: false, error: "Origem inválida." }, 403);
    const session = await requireApiSession();
    const viewerId = session?.user?.activeViewerId;
    if (!viewerId) return redemptionReply({ ok: false, error: "Entre novamente para continuar." }, 401);
    if ("id" in target) return redemptionReply({ ok: true, data: await saveCreatorCatalog(target.id, viewerId, await request.json()) });
    const tenant = await getCreatorAreaBySlug(target.slug, { hostname: request.headers.get("x-forwarded-host") ?? request.headers.get("host") });
    if (!tenant) throw new RedemptionAccessError();
    return redemptionReply({ ok: true, data: await purchaseCreatorItem(tenant.creator.id, viewerId, await request.json()) });
  } catch (error) { return redemptionFailure(error); }
}
