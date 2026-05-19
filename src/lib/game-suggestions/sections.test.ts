import { describe, expect, it } from "vitest";

import { getVisibleGameSuggestionSections } from "@/lib/game-suggestions/sections";
import type { GameSuggestionWithMeta } from "@/lib/types";

function suggestion(input: {
  id: string;
  status: GameSuggestionWithMeta["status"];
  totalVotes: number;
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
    status: input.status,
    totalVotes: input.totalVotes,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    suggestedBy: "Ludy",
    suggestedByYoutubeHandle: null,
    viewerBoostTotal: 0,
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
});
