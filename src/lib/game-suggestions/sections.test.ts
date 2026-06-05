import { describe, expect, it } from "vitest";

import { getVisibleGameSuggestionSections } from "@/lib/game-suggestions/sections";
import type { GameSuggestionWithMeta } from "@/lib/types";

function suggestion(input: {
  id: string;
  status: GameSuggestionWithMeta["status"];
  totalVotes: number;
  boostedScore?: number;
  createdAt: string;
}): GameSuggestionWithMeta {
  return {
    id: input.id,
    viewerId: `viewer-${input.id}`,
    slug: input.id,
    name: input.id,
    description: null,
    linkUrl: null,
    igdbId: null,
    canonicalName: null,
    coverImageUrl: null,
    releaseYear: null,
    platforms: [],
    genres: [],
    howLongToBeat: null,
    psPlusAvailable: false,
    psPlusRegion: null,
    psPlusTier: null,
    psPlusProductId: null,
    psPlusTitleId: null,
    psPlusProductUrl: null,
    psPlusCheckedAt: null,
    psPlusLastSeenAt: null,
    steamStore: null,
    status: input.status,
    totalVotes: input.totalVotes,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    suggestedBy: "Ludy",
    suggestedByYoutubeHandle: null,
    viewerBoostTotal: 0,
    boostedScore: input.boostedScore ?? input.totalVotes,
    appliedBoostModifiers: [],
  };
}

describe("getVisibleGameSuggestionSections", () => {
  it("separates played games from active recommendations", () => {
    const sections = getVisibleGameSuggestionSections([
      suggestion({ id: "played-high", status: "played", totalVotes: 999, createdAt: "2026-01-01T10:00:00.000Z" }),
      suggestion({ id: "open-low", status: "open", totalVotes: 10, createdAt: "2026-01-02T10:00:00.000Z" }),
      suggestion({ id: "accepted-mid", status: "accepted", totalVotes: 50, createdAt: "2026-01-03T10:00:00.000Z" }),
      suggestion({ id: "rejected", status: "rejected", totalVotes: 1000, createdAt: "2026-01-04T10:00:00.000Z" }),
    ]);

    expect(sections.recommendedSuggestions.map((entry) => entry.id)).toEqual(["accepted-mid", "open-low"]);
    expect(sections.playedSuggestions.map((entry) => entry.id)).toEqual(["played-high"]);
    expect(sections.visibleCount).toBe(3);
  });

  it("keeps vote and date ordering inside each section", () => {
    const sections = getVisibleGameSuggestionSections([
      suggestion({ id: "open-older", status: "open", totalVotes: 10, createdAt: "2026-01-01T10:00:00.000Z" }),
      suggestion({ id: "played-newer", status: "played", totalVotes: 5, createdAt: "2026-01-04T10:00:00.000Z" }),
      suggestion({ id: "open-newer", status: "open", totalVotes: 10, createdAt: "2026-01-03T10:00:00.000Z" }),
      suggestion({ id: "played-higher", status: "played", totalVotes: 30, createdAt: "2026-01-02T10:00:00.000Z" }),
    ]);

    expect(sections.recommendedSuggestions.map((entry) => entry.id)).toEqual(["open-newer", "open-older"]);
    expect(sections.playedSuggestions.map((entry) => entry.id)).toEqual(["played-higher", "played-newer"]);
  });

  it("orders by effective boosted score before raw votes", () => {
    const sections = getVisibleGameSuggestionSections([
      suggestion({
        id: "raw-higher",
        status: "open",
        totalVotes: 100,
        boostedScore: 100,
        createdAt: "2026-01-01T10:00:00.000Z",
      }),
      suggestion({
        id: "boosted-priority",
        status: "open",
        totalVotes: 80,
        boostedScore: 120,
        createdAt: "2026-01-02T10:00:00.000Z",
      }),
    ]);

    expect(sections.recommendedSuggestions.map((entry) => entry.id)).toEqual([
      "boosted-priority",
      "raw-higher",
    ]);
  });
});
