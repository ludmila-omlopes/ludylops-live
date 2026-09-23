import { ZodError } from "zod";
import { isTrustedAppMutationRequest, requireApiSession } from "@/lib/api";
import { CurrencyAccessError } from "@/lib/creators/currency.server";
import { getOwnedChatRewards, updateOwnedChatRewards } from "@/lib/creators/chat-rewards-settings.server";
import { economyReply as reply } from "@/lib/creators/economy-api";

type Context = { params: Promise<{ id: string }> };
function failure(error: unknown) {
  if (error instanceof CurrencyAccessError) return reply({ ok: false, error: error.message }, 404);
  if (error instanceof ZodError || error instanceof SyntaxError)
    return reply({ ok: false, error: "Use de 1 a 10.000 por mensagem e um intervalo de 10 a 86.400 segundos." }, 400);
  return reply({ ok: false, error: "Não foi possível acessar os ganhos por mensagem. Tente novamente mais tarde." }, 503);
}
export async function GET(_request: Request, { params }: Context) {
  try {
    const session = await requireApiSession();
    if (!session?.user?.activeViewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    return reply({ ok: true, data: await getOwnedChatRewards(session.user.activeViewerId, (await params).id) });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    if (!isTrustedAppMutationRequest(request)) return reply({ ok: false, error: "Origem inválida." }, 403);
    const session = await requireApiSession();
    if (!session?.user?.activeViewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    return reply({ ok: true, data: await updateOwnedChatRewards(session.user.activeViewerId, (await params).id, await request.json()) });
  } catch (error) { return failure(error); }
}
