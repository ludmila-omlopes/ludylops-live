import { describe, expect, it } from "vitest";

import { shouldSkipGameSearch } from "@/components/admin-current-game-panel";

describe("shouldSkipGameSearch", () => {
  it("skips the initial search when the input already matches the current game", () => {
    expect(
      shouldSkipGameSearch({
        query: "Clair Obscur: Expedition 33",
        currentGameName: "Clair Obscur: Expedition 33",
        selectedGameName: null,
      }),
    ).toBe(true);
  });

  it("skips the search after selecting a game from the results", () => {
    expect(
      shouldSkipGameSearch({
        query: "Hades II",
        currentGameName: "Clair Obscur: Expedition 33",
        selectedGameName: "Hades II",
      }),
    ).toBe(true);
  });

  it("allows a search when the query differs from the current and selected games", () => {
    expect(
      shouldSkipGameSearch({
        query: "Hades II",
        currentGameName: "Clair Obscur: Expedition 33",
        selectedGameName: null,
      }),
    ).toBe(false);
  });
});
