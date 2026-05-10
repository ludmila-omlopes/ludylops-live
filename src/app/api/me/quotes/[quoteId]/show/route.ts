import { fail, isTrustedAppMutationRequest, ok, requireApiSession } from "@/lib/api";
import { showQuoteOverlayForViewer } from "@/lib/db/repository";
import { showQuoteOverlaySchema } from "@/lib/streamerbot/schemas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireApiSession();
  if (!session?.user?.activeViewerId) {
    return fail("Unauthorized", 401);
  }

  const { quoteId } = await params;
  const parsedQuoteId = Number.parseInt(quoteId, 10);
  if (!Number.isInteger(parsedQuoteId) || parsedQuoteId <= 0) {
    return fail("quote_id_required", 400);
  }

  const payload = showQuoteOverlaySchema.parse(await request.json());

  try {
    const result = await showQuoteOverlayForViewer({
      viewerId: session.user.activeViewerId,
      quoteId: parsedQuoteId,
      source: payload.source,
    });

    return ok(result, { status: result.queued ? 202 : 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao mostrar quote no overlay.";
    return fail(message, 400);
  }
}
