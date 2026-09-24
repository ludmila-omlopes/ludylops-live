import { isTrustedAppMutationRequest, requireApiSession } from "@/lib/api";
import { getCreatorOperations, recoverCreatorRedemption } from "@/lib/creators/redemptions.server";
import { redemptionFailure, redemptionReply as reply } from "@/lib/creators/redemptions-api";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    const viewerId = (await requireApiSession())?.user?.activeViewerId;
    if (!viewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    return reply({ ok: true, data: await getCreatorOperations((await params).id, viewerId) });
  } catch (error) { return redemptionFailure(error); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    if (!isTrustedAppMutationRequest(request)) return reply({ ok: false, error: "Origem inválida." }, 403);
    const viewerId = (await requireApiSession())?.user?.activeViewerId;
    if (!viewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    return reply({ ok: true, data: await recoverCreatorRedemption((await params).id, viewerId, await request.json()) });
  } catch (error) { return redemptionFailure(error); }
}
