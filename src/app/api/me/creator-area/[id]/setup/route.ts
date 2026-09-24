import { requireApiSession } from "@/lib/api";
import { getOwnedCreatorSetup, SetupAccessError } from "@/lib/creators/setup.server";
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewerId = (await requireApiSession())?.user?.activeViewerId;
    if (!viewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    return reply({ ok: true, data: await getOwnedCreatorSetup(viewerId, (await params).id) });
  } catch (error) {
    return error instanceof SetupAccessError ? reply({ ok: false, error: "Comunidade não encontrada." }, 404) : reply({ ok: false, error: "Não foi possível verificar a configuração. Tente novamente mais tarde." }, 503);
  }
}
