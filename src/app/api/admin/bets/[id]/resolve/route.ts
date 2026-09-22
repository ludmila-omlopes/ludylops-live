import { guardModuleRequest } from '@/lib/creators/module-access';
import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { resolveBet } from "@/lib/db/repository";
import { resolveBetSchema } from "@/lib/streamerbot/schemas";

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
  const payload = resolveBetSchema.parse(await request.json());

  try {
    return ok(await resolveBet({ betId: id, winningOptionId: payload.winningOptionId }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao resolver aposta.";
    return fail(message, 400);
  }
}
