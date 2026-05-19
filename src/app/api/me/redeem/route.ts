import { fail, isTrustedAppMutationRequest, ok, requireLinkedApiSession } from "@/lib/api";
import { redeemItem } from "@/lib/db/repository";
import { redeemSchema } from "@/lib/streamerbot/schemas";

export async function POST(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireLinkedApiSession();
  if (!session?.user?.activeViewerId) {
    return fail("Unauthorized", 401);
  }

  const json = await request.json();
  const payload = redeemSchema.parse(json);

  try {
    const redemption = await redeemItem({
      viewerId: session.user.activeViewerId,
      itemId: payload.itemId,
      source: payload.source,
    });
    return ok(redemption, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao resgatar.";
    return fail(message, 400);
  }
}
