import { ZodError } from "zod";
import { isTrustedAppMutationRequest, requireApiSession } from "@/lib/api";
import { ModuleChoiceError } from "@/lib/creators/module-choices";
import { getOwnedModuleChoices, ModuleChoicesAccessError, updateOwnedModuleChoices } from "@/lib/creators/module-choices.server";

type Context = { params: Promise<{ id: string }> };
const reply = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store" },
});
function failure(error: unknown) {
  if (error instanceof ModuleChoicesAccessError) return reply({ ok: false, error: error.message }, 404);
  if (error instanceof ZodError) return reply({ ok: false, error: "Escolha módulos válidos." }, 400);
  if (error instanceof ModuleChoiceError) return reply({ ok: false, error: error.message }, 409);
  return reply({ ok: false, error: "Não foi possível acessar os módulos agora. Tente novamente mais tarde." }, 503);
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const session = await requireApiSession();
    if (!session?.user?.activeViewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    const { id } = await params;
    return reply({ ok: true, data: await getOwnedModuleChoices(session.user.activeViewerId, id) });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    if (!isTrustedAppMutationRequest(request)) return reply({ ok: false, error: "Origem inválida." }, 403);
    const session = await requireApiSession();
    if (!session?.user?.activeViewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    const input = await request.json().catch(() => null);
    const { id } = await params;
    return reply({ ok: true, data: await updateOwnedModuleChoices(session.user.activeViewerId, id, input) });
  } catch (error) { return failure(error); }
}
