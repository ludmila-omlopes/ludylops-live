import { describe, expect, it } from "vitest";
import { safeYoutubeStickerUrl, superStickerSchema } from "./youtube-stickers";

describe("YouTube sticker assets", () => {
  it.each([
    "https://yt3.ggpht.com/sticker=w512-h512-no?animation=1",
    "https://lh3.googleusercontent.com/sticker.webp",
    "https://www.gstatic.com/youtube/img/super_stickers/sticker.gif",
  ])("preserves the exact original URL: %s", url => expect(safeYoutubeStickerUrl(url)).toBe(url));
  it.each([null, "", "javascript:alert(1)", "data:image/svg+xml,test", "http://yt3.ggpht.com/a",
    "https://yt3.ggpht.com.evil.test/a", "https://evil.test/?yt3.ggpht.com", "https://127.0.0.1/a",
    "https://user:secret@yt3.ggpht.com/a", "https://yt3.ggpht.com:444/a", "https://www.gstatic.com/other/a",
  ])("falls back safely for %s", url => expect(safeYoutubeStickerUrl(url)).toBeNull());
  it("requires stable message identity, rejects creator spoofing and permits missing images", () => {
    expect(superStickerSchema.safeParse({}).success).toBe(false);
    expect(superStickerSchema.safeParse({ messageId: "m", creatorId: "other" }).success).toBe(false);
    expect(superStickerSchema.parse({ messageId: "m" }).stickerImageUrl).toBeNull();
    expect(superStickerSchema.parse({ messageId: "m", stickerImageUrl: "https://evil.test/a" }).stickerImageUrl).toBeNull();
  });
});
