import { ZodError } from "zod";
import { isTrustedAppMutationRequest, requireApiSession } from "@/lib/api";
import { CurrencyAccessError, getOwnedCurrency, updateOwnedCurrency } from "@/lib/creators/currency.server";

type Context = { params: Promise<{ id: string }> };
const reply = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store" },
});
function failure(error: unknown) {
  if (error instanceof CurrencyAccessError) return reply({ ok: false, error: error.message }, 404);
  if (error instanceof ZodError) return reply({ ok: false, error: "Informe um nome de moeda válido, com até 32 caracteres." }, 400);
  return reply({ ok: false, error: "Não foi possível acessar a moeda agora. Tente novamente mais tarde." }, 503);
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const session = await requireApiSession();
    if (!session?.user?.activeViewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    const { id } = await params;
    return reply({ ok: true, data: await getOwnedCurrency(session.user.activeViewerId, id) });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    if (!isTrustedAppMutationRequest(request)) return reply({ ok: false, error: "Origem inválida." }, 403);
    const session = await requireApiSession();
    if (!session?.user?.activeViewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    const input = await request.json().catch(() => null);
    const { id } = await params;
    return reply({ ok: true, data: await updateOwnedCurrency(session.user.activeViewerId, id, input) });
  } catch (error) { return failure(error); }
}
