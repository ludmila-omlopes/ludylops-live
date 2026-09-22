import { guardModuleRequest } from '@/lib/creators/module-access';
import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { lockBet } from "@/lib/db/repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const moduleDenial = await guardModuleRequest(request, ["bets"]);
  if (moduleDenial) return moduleDenial;

  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  const { id } = await params;
  try {
    return ok(await lockBet(id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao travar aposta.";
    return fail(message, 400);
  }
}
