"use client";

import { useEffect, useState } from "react";

import { GameSuggestionCard } from "@/components/game-suggestion-card";
import type { GameSuggestionWithMeta } from "@/lib/types";

export function GameSuggestionList({
  suggestions,
  loggedIn = false,
  canInteract = false,
  isAdmin = false,
  viewerBalance,
}: {
  suggestions: GameSuggestionWithMeta[];
  loggedIn?: boolean;
  canInteract?: boolean;
  isAdmin?: boolean;
  viewerBalance?: number | null;
}) {
  const [localSuggestions, setLocalSuggestions] = useState(suggestions);
  const [localBalance, setLocalBalance] = useState<number | null>(viewerBalance ?? null);

  useEffect(() => {
    setLocalSuggestions(suggestions);
  }, [suggestions]);

  useEffect(() => {
    setLocalBalance(viewerBalance ?? null);
  }, [viewerBalance]);

  function handleBoostSuccess(updatedSuggestion: GameSuggestionWithMeta, spentAmount: number) {
    setLocalSuggestions((current) =>
      current.map((suggestion) =>
        suggestion.id === updatedSuggestion.id ? updatedSuggestion : suggestion,
      ),
    );

    setLocalBalance((current) =>
      typeof current === "number" ? Math.max(current - spentAmount, 0) : current,
    );
  }

  function handleCatalogUpdate(updatedSuggestion: GameSuggestionWithMeta) {
    setLocalSuggestions((current) =>
      current.map((suggestion) =>
        suggestion.id === updatedSuggestion.id ? updatedSuggestion : suggestion,
      ),
    );
  }

  const sorted = [...localSuggestions].sort((a, b) => {
    if (b.totalVotes !== a.totalVotes) {
      return b.totalVotes - a.totalVotes;
    }

    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });
  const visibleSuggestions = sorted.filter((suggestion) => suggestion.status !== "rejected");

  return (
    <div className="grid gap-4">
      {visibleSuggestions.map((suggestion, index) => (
        <GameSuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          index={index}
          loggedIn={loggedIn}
          canBoost={canInteract}
          canEditCatalog={isAdmin}
          viewerBalance={localBalance}
          onBoostSuccess={handleBoostSuccess}
          onCatalogUpdate={handleCatalogUpdate}
        />
      ))}
    </div>
  );
}
