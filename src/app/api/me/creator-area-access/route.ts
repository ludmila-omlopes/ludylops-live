import { fail, isTrustedAppMutationRequest, ok, requireApiSession } from "@/lib/api";
import { canCreateCreatorArea, getCreatorBetaRequest, submitCreatorBetaRequest } from "@/lib/creators/access";

export async function GET() {
  const session = await requireApiSession();
  if (!session) return fail("Entre com sua conta para solicitar acesso.", 401);
  try {
    const email = session.user!.email!;
    const [canCreate, request] = await Promise.all([canCreateCreatorArea(email), getCreatorBetaRequest(email)]);
    return ok({ canCreate, request }, { headers: { "cache-control": "no-store" } });
  } catch {
    return fail("Não foi possível consultar sua solicitação. Tente novamente.", 503);
  }
}

export async function POST(request: Request) {
  if (!isTrustedAppMutationRequest(request)) return fail("Forbidden", 403);
  const session = await requireApiSession();
  if (!session) return fail("Entre com sua conta para solicitar acesso.", 401);
  try {
    // The authenticated identity is authoritative; submitted emails are never used.
    return ok(await submitCreatorBetaRequest(session.user!.email!));
  } catch {
    return fail("Não foi possível enviar sua solicitação. Tente novamente.", 503);
  }
}
