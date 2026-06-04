import type { GameSuggestionWithMeta } from "@/lib/types";

function sortGameSuggestions(items: GameSuggestionWithMeta[]) {
  return [...items].sort((a, b) => {
    if (b.boostedScore !== a.boostedScore) {
      return b.boostedScore - a.boostedScore;
    }

    if (b.totalVotes !== a.totalVotes) {
      return b.totalVotes - a.totalVotes;
    }

    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });
}

export function getVisibleGameSuggestionSections(suggestions: GameSuggestionWithMeta[]) {
  const visibleSuggestions = suggestions.filter((suggestion) => suggestion.status !== "rejected");

  return {
    recommendedSuggestions: sortGameSuggestions(
      visibleSuggestions.filter((suggestion) => suggestion.status !== "played"),
    ),
    playedSuggestions: sortGameSuggestions(
      visibleSuggestions.filter((suggestion) => suggestion.status === "played"),
    ),
    visibleCount: visibleSuggestions.length,
  };
}
