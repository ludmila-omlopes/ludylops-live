import type { CreatorContext } from "@/lib/creators/context";
import { superStickerSchema, type StickerAlert, type StickerBatch, type SuperStickerInput } from "@/lib/youtube-stickers";
import { createYoutubeAlertFeed } from "./youtube-alert-feed";

declare global { var __youtubeStickerDemoAlerts: (StickerAlert & { creatorId: string })[] | undefined; }

const feed = createYoutubeAlertFeed({
  eventType: "youtube_super_sticker",
  eventIdPrefix: "sticker",
  lockPrefix: "stickers",
  demoGlobal: "__youtubeStickerDemoAlerts",
  schema: superStickerSchema,
  dedupeKey: payload => payload.messageId,
  toAlert: (id, receivedAt, payload): StickerAlert => ({ id, receivedAt, displayName: payload.displayName || "Alguém", amount: payload.amount,
    stickerAltText: payload.stickerAltText || "Super Sticker", stickerImageUrl: payload.stickerImageUrl }),
});

export function receiveSuperSticker(context: CreatorContext, input: SuperStickerInput) {
  return feed.receive(context, input);
}

export function listSuperStickers(context: CreatorContext, cursor?: string): Promise<StickerBatch> {
  return feed.list(context, cursor);
}
