import { CurrencyAccessError } from "@/lib/creators/currency.server";
import { communityReply as reply, communityViewerContext } from "@/lib/creators/community-api";
import { rewardCommunityPresence } from "@/lib/creators/page-rewards.server";

const unavailable = "Moeda indisponível para esta comunidade.";

/** The daily visit reward for the signed-in viewer; repeating it the same day credits nothing. */
export async function POST(request: Request, { params }: { params: Promise<{ creatorSlug: string }> }) {
  try {
    const context = await communityViewerContext(request, (await params).creatorSlug, { key: "points", operation: "economy", unavailable });
    if ("response" in context) return context.response;
    return reply({ ok: true, data: await rewardCommunityPresence(context.creatorId, context.viewerId) });
  } catch (error) {
    if (error instanceof CurrencyAccessError) return reply({ ok: false, error: unavailable }, 404);
    return reply({ ok: false, error: "Não foi possível registrar a visita agora." }, 503);
  }
}
