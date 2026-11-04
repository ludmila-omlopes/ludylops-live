import type { CreatorContext } from "@/lib/creators/context";
import { jewelGiftSchema, type GiftAlert, type GiftBatch, type JewelGiftInput } from "@/lib/youtube-gifts";
import { createYoutubeAlertFeed } from "./youtube-alert-feed";

declare global { var __youtubeGiftDemoAlerts: (GiftAlert & { creatorId: string })[] | undefined; }

const feed = createYoutubeAlertFeed({
  eventType: "youtube_jewel_gift",
  eventIdPrefix: "gift",
  lockPrefix: "gifts",
  demoGlobal: "__youtubeGiftDemoAlerts",
  schema: jewelGiftSchema,
  dedupeKey: payload => payload.eventId,
  toAlert: (id, receivedAt, payload): GiftAlert => ({ id, receivedAt, displayName: payload.displayName || "Alguém",
    giftName: payload.giftName || payload.giftAltText || "Presente", giftImageUrl: payload.giftImageUrl,
    jewelsAmount: payload.jewelsAmount, comboCount: payload.comboCount }),
});

export function receiveJewelGift(context: CreatorContext, input: JewelGiftInput) {
  return feed.receive(context, input);
}

export function listJewelGifts(context: CreatorContext, cursor?: string): Promise<GiftBatch> {
  return feed.list(context, cursor);
}
