import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
vi.mock("@/lib/env", () => ({ isDemoMode: true }));
import { jewelGiftSchema } from "@/lib/youtube-gifts";
afterEach(() => { delete globalThis.__youtubeGiftDemoAlerts; delete globalThis.__youtubeStickerDemoAlerts; vi.resetModules(); });

it("delivers gifts per creator, deduplicates retries and stays apart from Super Stickers", async () => {
  const gifts = await import("./gifts");
  const stickers = await import("./stickers");
  const input = jewelGiftSchema.parse({ eventId: "u1|2026-11-04T12:00:00Z|Estrela|1", displayName: "Ana", giftName: "Estrela", jewelsAmount: 10 });
  expect(await gifts.receiveJewelGift({ creatorId: "a" }, input)).toEqual({ deduped: false });
  expect(await gifts.receiveJewelGift({ creatorId: "a" }, input)).toEqual({ deduped: true });
  const batch = await gifts.listJewelGifts({ creatorId: "a" });
  expect(batch.alerts).toEqual([expect.objectContaining({ displayName: "Ana", giftName: "Estrela", jewelsAmount: 10, comboCount: 1 })]);
  expect(batch.alerts[0]).not.toHaveProperty("creatorId");
  expect((await gifts.listJewelGifts({ creatorId: "b" })).alerts).toEqual([]);
  expect((await gifts.listJewelGifts({ creatorId: "a" }, batch.cursor)).alerts).toEqual([]);
  expect((await stickers.listSuperStickers({ creatorId: "a" })).alerts).toEqual([]);
});
