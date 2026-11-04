import { z } from "zod";
import { safeYoutubeStickerUrl } from "@/lib/youtube-stickers";

// Gift images come from the same YouTube CDNs as Super Stickers (www.gstatic.com/youtube/...).
export const jewelGiftSchema = z.object({
  /** Stable per-event key built by the Streamer.bot script; reused on retries for deduplication. */
  eventId: z.string().trim().min(1).max(512),
  displayName: z.string().trim().max(255).default(""),
  giftName: z.string().trim().max(255).default(""),
  giftAltText: z.string().trim().max(500).default(""),
  giftImageUrl: z.string().max(2048).nullable().optional().transform(safeYoutubeStickerUrl),
  jewelsAmount: z.number().int().min(0).max(1_000_000).default(0),
  comboCount: z.number().int().min(1).max(100_000).default(1),
}).strict();

export type JewelGiftInput = z.input<typeof jewelGiftSchema>;
export type GiftAlert = {
  id: string;
  receivedAt: string;
  displayName: string;
  giftName: string;
  giftImageUrl: string | null;
  jewelsAmount: number;
  comboCount: number;
};
export type GiftBatch = { alerts: GiftAlert[]; cursor: string };

export function isGiftAlert(value: unknown): value is GiftAlert {
  const alert = value as GiftAlert | null;
  return typeof alert?.id === "string" && typeof alert.receivedAt === "string" && typeof alert.displayName === "string" &&
    typeof alert.giftName === "string" && (alert.giftImageUrl === null || typeof alert.giftImageUrl === "string") &&
    Number.isInteger(alert.jewelsAmount) && Number.isInteger(alert.comboCount);
}

/** Folds a combo (same person, same gift) into one alert instead of queueing every repeat. */
export function mergeGiftCombo(current: GiftAlert, incoming: GiftAlert): GiftAlert | null {
  if (current.displayName !== incoming.displayName || current.giftName !== incoming.giftName) return null;
  return {
    ...incoming,
    id: current.id,
    receivedAt: current.receivedAt,
    jewelsAmount: current.jewelsAmount + incoming.jewelsAmount,
    comboCount: Math.max(current.comboCount + 1, incoming.comboCount),
    giftImageUrl: incoming.giftImageUrl ?? current.giftImageUrl,
  };
}

export function formatJewels(amount: number) {
  return `${amount.toLocaleString("pt-BR")} ${amount === 1 ? "joia" : "joias"}`;
}
