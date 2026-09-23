import { ZodError } from "zod";
import { isTrustedAppMutationRequest, requireApiSession } from "@/lib/api";
import { CreatorProfileAccessError, CreatorProfileConflictError, getOwnedCreatorProfile, updateOwnedCreatorProfile } from "@/lib/creators/profile.server";

type Context = { params: Promise<{ id: string }> };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function failure(error: unknown) {
  if (error instanceof CreatorProfileAccessError) return reply({ ok: false, error: "Comunidade indisponível." }, 404);
  if (error instanceof CreatorProfileConflictError) return reply({ ok: false, error: "O nome ou as cores mudaram desde a última consulta. Recarregue os dados antes de salvar." }, 409);
  if (error instanceof ZodError || error instanceof SyntaxError) return reply({ ok: false, error: "Use um nome de 2 a 80 caracteres e cores como #c7a2e9." }, 400);
  return reply({ ok: false, error: "Não foi possível acessar os dados da comunidade. Tente novamente mais tarde." }, 503);
}
export async function GET(_request: Request, { params }: Context) {
  try {
    const session = await requireApiSession();
    if (!session?.user?.activeViewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    return reply({ ok: true, data: await getOwnedCreatorProfile(session.user.activeViewerId, (await params).id) });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    if (!isTrustedAppMutationRequest(request)) return reply({ ok: false, error: "Origem inválida." }, 403);
    const session = await requireApiSession();
    if (!session?.user?.activeViewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    return reply({ ok: true, data: await updateOwnedCreatorProfile(session.user.activeViewerId, (await params).id, await request.json()) });
  } catch (error) { return failure(error); }
}
