import { describe, expect, it } from "vitest";
import { formatJewels, jewelGiftSchema, mergeGiftCombo, type GiftAlert } from "./youtube-gifts";

const gift = (patch: Partial<GiftAlert> = {}): GiftAlert => ({ id: "a", receivedAt: "2026-11-04T12:00:00.000Z", displayName: "Ana",
  giftName: "Estrela", giftImageUrl: "https://www.gstatic.com/youtube/img/pdg/gift/assets/star.png", jewelsAmount: 10, comboCount: 1, ...patch });

describe("YouTube jewel gifts", () => {
  it("requires a stable event id, rejects creator spoofing and keeps only YouTube images", () => {
    expect(jewelGiftSchema.safeParse({}).success).toBe(false);
    expect(jewelGiftSchema.safeParse({ eventId: "e", creatorId: "other" }).success).toBe(false);
    expect(jewelGiftSchema.parse({ eventId: "e", giftImageUrl: "https://www.gstatic.com/youtube/img/pdg/gift/assets/keep_it_up.png" }).giftImageUrl)
      .toBe("https://www.gstatic.com/youtube/img/pdg/gift/assets/keep_it_up.png");
    expect(jewelGiftSchema.parse({ eventId: "e", giftImageUrl: "https://evil.test/a.png" }).giftImageUrl).toBeNull();
    expect(jewelGiftSchema.parse({ eventId: "e" })).toMatchObject({ jewelsAmount: 0, comboCount: 1, giftImageUrl: null });
    expect(jewelGiftSchema.safeParse({ eventId: "e", jewelsAmount: -1 }).success).toBe(false);
  });
  it("folds a combo from the same person and gift, keeping the first alert identity", () => {
    const merged = mergeGiftCombo(gift(), gift({ id: "b", receivedAt: "2026-11-04T12:00:01.000Z", comboCount: 2 }));
    expect(merged).toMatchObject({ id: "a", receivedAt: "2026-11-04T12:00:00.000Z", jewelsAmount: 20, comboCount: 2 });
    expect(mergeGiftCombo(merged!, gift({ id: "c", comboCount: 1 }))?.comboCount).toBe(3);
  });
  it("keeps different senders and gifts apart", () => {
    expect(mergeGiftCombo(gift(), gift({ id: "b", displayName: "Bia" }))).toBeNull();
    expect(mergeGiftCombo(gift(), gift({ id: "b", giftName: "F no chat" }))).toBeNull();
  });
  it("formats jewel amounts in Brazilian Portuguese", () => {
    expect(formatJewels(1)).toBe("1 joia");
    expect(formatJewels(1500)).toBe("1.500 joias");
  });
});
