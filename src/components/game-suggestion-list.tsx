"use client";

import { useEffect, useState } from "react";

import { GameSuggestionCard } from "@/components/game-suggestion-card";
import { getVisibleGameSuggestionSections } from "@/lib/game-suggestions/sections";
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

  const { recommendedSuggestions, playedSuggestions, visibleCount } =
    getVisibleGameSuggestionSections(localSuggestions);

  return (
    <div className="grid gap-4">
      {visibleCount === 0 ? (
        <div className="card-brutal-static bg-[var(--color-paper)] p-4 text-sm font-bold text-[var(--color-ink-soft)]">
          Nenhuma sugestão disponível no momento.
        </div>
      ) : null}

      {recommendedSuggestions.map((suggestion, index) => (
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

      {playedSuggestions.length > 0 ? (
        <section className="mt-6 grid gap-4 border-t-2 border-dashed border-[var(--color-ink)] pt-6">
          <div>
            <h3
              className="text-xl font-bold uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Jogos já jogados
            </h3>
          </div>

          {playedSuggestions.map((suggestion, index) => (
            <GameSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              index={recommendedSuggestions.length + index}
              loggedIn={loggedIn}
              canBoost={canInteract}
              canEditCatalog={isAdmin}
              viewerBalance={localBalance}
              onBoostSuccess={handleBoostSuccess}
              onCatalogUpdate={handleCatalogUpdate}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
