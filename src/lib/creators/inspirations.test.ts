import { describe, expect, it } from "vitest";

import { communityInspirationInputSchema, normalizeInspirationLink } from "./inspirations";

describe("inspiration links", () => {
  it.each([
    ["https://www.youtube.com/@Canal/", "https://youtube.com/@Canal", "youtube"],
    ["http://youtube.com/channel/UCabcdefghijklmnopqrstuv?si=x#top", "https://youtube.com/channel/UCabcdefghijklmnopqrstuv", "youtube"],
    ["https://m.twitch.tv/alguem", "https://m.twitch.tv/alguem", "twitch"],
    ["https://kick.com/alguem", "https://kick.com/alguem", "kick"],
    ["https://instagram.com/alguem", "https://instagram.com/alguem", "other"],
  ])("normalizes %s", (raw, url, platform) => {
    expect(normalizeInspirationLink(raw)).toEqual({ url, platform });
  });

  it.each(["javascript:alert(1)", "data:text/html,oi", "https://user:pass@youtube.com/@canal", "ftp://youtube.com/x", "https://localhost/x", "não é link"])(
    "refuses %s",
    (raw) => expect(normalizeInspirationLink(raw)).toBeNull(),
  );

  it("accepts only name, link and reason", () => {
    expect(communityInspirationInputSchema.parse({ name: " Ana ", channelUrl: "https://youtube.com/@ana", reason: "" }))
      .toEqual({ name: "Ana", channelUrl: "https://youtube.com/@ana", reason: null });
    expect(communityInspirationInputSchema.safeParse({ name: "Ana", channelUrl: "https://youtube.com/@ana", status: "featured" }).success).toBe(false);
    expect(communityInspirationInputSchema.safeParse({ name: "A", channelUrl: "https://youtube.com/@ana" }).success).toBe(false);
  });
});
