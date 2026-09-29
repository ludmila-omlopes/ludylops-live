import { fail, ok, requireAdminApiSession } from "@/lib/api";
import { listPendingCreatorBetaRequests } from "@/lib/creators/access";

export async function GET(request: Request) {
  if (!await requireAdminApiSession()) return fail("Forbidden", 403);
  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
  if (cursor && !/^creator_beta_request:[a-f0-9]{40}$/.test(cursor)) return fail("Cursor inválido.", 400);
  try {
    return ok(await listPendingCreatorBetaRequests(cursor), { headers: { "cache-control": "no-store" } });
  } catch {
    return fail("Não foi possível consultar os pedidos. Tente novamente.", 503);
  }
}
