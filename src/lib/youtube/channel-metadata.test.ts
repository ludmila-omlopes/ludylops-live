import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { YOUTUBE_API_KEY: "youtube-test-key" },
}));

import {
  extractYoutubeChannelReference,
  resolveYoutubeChannelMetadata,
} from "@/lib/youtube/channel-metadata";

describe("YouTube channel metadata", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts supported channel URL references", () => {
    expect(extractYoutubeChannelReference("https://www.youtube.com/@canal")).toEqual({
      kind: "handle",
      value: "canal",
    });
    expect(extractYoutubeChannelReference("https://www.youtube.com/channel/UC12345678901234567890")).toEqual({
      kind: "id",
      value: "UC12345678901234567890",
    });
    expect(extractYoutubeChannelReference("https://www.youtube.com/user/canal")).toEqual({
      kind: "username",
      value: "canal",
    });
    expect(extractYoutubeChannelReference("https://www.youtube.com/watch?v=video")).toBeNull();
  });

  it("resolves the channel name and canonical URL from YouTube", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "UC12345678901234567890",
              snippet: {
                title: "Canal Teste",
                customUrl: "@canalteste",
                description: "Descrição do canal teste.",
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveYoutubeChannelMetadata("https://www.youtube.com/@canalteste")).resolves.toEqual({
      name: "Canal Teste",
      channelUrl: "https://www.youtube.com/@canalteste",
      description: "Descrição do canal teste.",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining("forHandle=canalteste"),
      }),
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
