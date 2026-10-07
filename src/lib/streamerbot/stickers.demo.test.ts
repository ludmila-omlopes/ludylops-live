import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
vi.mock("@/lib/env", () => ({ isDemoMode: true }));
import { superStickerSchema } from "@/lib/youtube-stickers";
afterEach(() => { delete globalThis.__youtubeStickerDemoAlerts; vi.resetModules(); });

it("shares demo delivery across separately loaded route modules and retains deduplication", async () => {
  const writer = await import("./stickers");
  const input = superStickerSchema.parse({ messageId: "demo-one", displayName: "João" });
  expect(await writer.receiveSuperSticker({ creatorId: "a" }, input)).toEqual({ deduped: false });
  vi.resetModules();
  const reader = await import("./stickers");
  const batch = await reader.listSuperStickers({ creatorId: "a" });
  expect(batch.alerts).toHaveLength(1);
  expect(await reader.receiveSuperSticker({ creatorId: "a" }, input)).toEqual({ deduped: true });
  expect((await reader.listSuperStickers({ creatorId: "b" })).alerts).toEqual([]);
  expect((await reader.listSuperStickers({ creatorId: "a" }, batch.cursor)).alerts).toEqual([]);
});
