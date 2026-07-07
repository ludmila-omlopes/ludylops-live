import { fail, isTrustedAppMutationRequest, ok, requireLinkedApiSession } from "@/lib/api";
import { placeBet } from "@/lib/db/repository";
import { placeBetSchema } from "@/lib/streamerbot/schemas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ betId: string }> },
) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireLinkedApiSession();
  if (!session?.user?.activeViewerId) {
    return fail("Unauthorized", 401);
  }

  const { betId } = await params;
  const payload = placeBetSchema.parse(await request.json());

  try {
    const entry = await placeBet({
      viewerId: session.user.activeViewerId,
      betId,
      optionId: payload.optionId ?? null,
      optionLabel: payload.optionLabel ?? null,
      amount: payload.amount,
      source: payload.source,
    });
    return ok(entry, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao registrar aposta.";
    return fail(message, 400);
  }
}
