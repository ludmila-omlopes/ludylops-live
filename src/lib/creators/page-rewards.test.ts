import { describe, expect, it } from "vitest";

import { defaultPageRewards, getPageRewardSettings, pageRewardSettingsSchema, presenceDay, startingPageRewards, suggestionBonusReason } from "./page-rewards";

describe("page rewards", () => {
  it("counts the visit day in Brasília time", () => {
    expect(presenceDay(new Date("2026-10-07T02:59:00Z"))).toBe("2026-10-06");
    expect(presenceDay(new Date("2026-10-07T03:00:00Z"))).toBe("2026-10-07");
  });

  it("keeps rewards off for currencies saved before them and on for fresh installs", () => {
    expect(getPageRewardSettings({ currencyLabel: "cristais" })).toEqual(defaultPageRewards);
    expect(defaultPageRewards).toMatchObject({ presenceEnabled: false, suggestionBonusEnabled: false });
    expect(getPageRewardSettings({ pageRewards: startingPageRewards })).toEqual(startingPageRewards);
    expect(getPageRewardSettings({ pageRewards: { ...startingPageRewards, presenceAmount: 0 } })).toEqual(defaultPageRewards);
  });

  it("accepts only whole amounts from 1 to 10.000", () => {
    for (const presenceAmount of [0, 1.5, 10_001]) expect(pageRewardSettingsSchema.safeParse({ ...startingPageRewards, presenceAmount }).success).toBe(false);
    expect(suggestionBonusReason("x".repeat(300))).toHaveLength(160);
  });
});
