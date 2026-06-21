"use client";

import { useEffect, useState } from "react";
import { LayoutGridIcon, ListIcon, PlusIcon } from "lucide-react";

import { GameSuggestForm } from "@/components/game-suggest-form";
import { GameSuggestionCard } from "@/components/game-suggestion-card";
import { Button } from "@/components/ui/button";
import { getVisibleGameSuggestionSections } from "@/lib/game-suggestions/sections";
import type { GameSuggestionWithMeta } from "@/lib/types";
import { cn, formatPipetz } from "@/lib/utils";

type ViewMode = "list" | "grid";

export function GameSuggestionList({
  suggestions,
  loggedIn = false,
  canInteract = false,
  isAdmin = false,
  viewerBalance,
  creationCost,
}: {
  suggestions: GameSuggestionWithMeta[];
  loggedIn?: boolean;
  canInteract?: boolean;
  isAdmin?: boolean;
  viewerBalance?: number | null;
  creationCost: number;
}) {
  const [localSuggestions, setLocalSuggestions] = useState(suggestions);
  const [localBalance, setLocalBalance] = useState<number | null>(viewerBalance ?? null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);

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
  const openCount = recommendedSuggestions.filter((suggestion) => suggestion.status === "open").length;
  const suggestionListClassName = cn("grid gap-4", viewMode === "grid" && "items-start");
  const suggestionListStyle =
    viewMode === "grid"
      ? { gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }
      : undefined;

  function renderSuggestionCards(items: GameSuggestionWithMeta[], indexOffset = 0) {
    return items.map((suggestion, index) => (
      <GameSuggestionCard
        key={suggestion.id}
        suggestion={suggestion}
        index={indexOffset + index}
        viewMode={viewMode}
        loggedIn={loggedIn}
        canBoost={canInteract}
        canEditCatalog={isAdmin}
        viewerBalance={localBalance}
        onBoostSuccess={handleBoostSuccess}
        onCatalogUpdate={handleCatalogUpdate}
      />
    ));
  }

  return (
    <div className="grid gap-5">
      <div className="panel surface-section p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <h2
              className="text-2xl font-bold uppercase sm:text-3xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Sugestões da galera
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink-soft)]">
              Enviar uma sugestão custa {formatPipetz(creationCost)}. A comunidade pode dar boost para aumentar a prioridade dos jogos na lista.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
            <div className="grid grid-cols-2 border-2 border-[var(--color-ink)] bg-[var(--color-paper)] text-center">
              <div className="border-r-2 border-[var(--color-ink)] px-4 py-2">
                <p
                  className="text-2xl font-bold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {visibleCount}
                </p>
                <p className="mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                  visíveis
                </p>
              </div>
              <div className="px-4 py-2">
                <p
                  className="text-2xl font-bold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {openCount}
                </p>
                <p className="mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                  abertas
                </p>
              </div>
            </div>

            <div
              className="inline-grid grid-cols-2 border-2 border-[var(--color-ink)] bg-[var(--color-paper)]"
              aria-label="Modo de visualização"
            >
              <button
                type="button"
                aria-pressed={viewMode === "list"}
                aria-label="Visualizar sugestões em lista"
                onClick={() => setViewMode("list")}
                className={cn(
                  "inline-flex h-11 items-center justify-center gap-2 border-r-2 border-[var(--color-ink)] px-3 text-xs font-black uppercase outline-none focus-visible:outline-[3px] focus-visible:outline-[var(--color-purple-mid)]",
                  viewMode === "list"
                    ? "bg-[var(--color-ink)] text-[var(--color-accent-ink)]"
                    : "text-[var(--color-ink)] hover:bg-[var(--color-sky)]",
                )}
              >
                <ListIcon className="size-4" aria-hidden="true" />
                Lista
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "grid"}
                aria-label="Visualizar sugestões em grade"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "inline-flex h-11 items-center justify-center gap-2 px-3 text-xs font-black uppercase outline-none focus-visible:outline-[3px] focus-visible:outline-[var(--color-purple-mid)]",
                  viewMode === "grid"
                    ? "bg-[var(--color-ink)] text-[var(--color-accent-ink)]"
                    : "text-[var(--color-ink)] hover:bg-[var(--color-sky)]",
                )}
              >
                <LayoutGridIcon className="size-4" aria-hidden="true" />
                Grade
              </button>
            </div>

            <Button
              type="button"
              onClick={() => setIsSuggestModalOpen(true)}
              variant="accent"
              size="lg"
              className="gap-2"
            >
              <PlusIcon className="size-4" aria-hidden="true" />
              Sugerir jogo
            </Button>
          </div>
        </div>
      </div>

      {visibleCount === 0 ? (
        <div className="card-brutal-static bg-[var(--color-paper)] p-4 text-sm font-bold text-[var(--color-ink-soft)]">
          Nenhuma sugestão disponível no momento.
        </div>
      ) : null}

      <div className={suggestionListClassName} style={suggestionListStyle}>
        {renderSuggestionCards(recommendedSuggestions)}
      </div>

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

          <div className={suggestionListClassName} style={suggestionListStyle}>
            {renderSuggestionCards(playedSuggestions, recommendedSuggestions.length)}
          </div>
        </section>
      ) : null}

      {isSuggestModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-backdrop)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-suggestion-modal-title"
        >
          <GameSuggestForm
            loggedIn={loggedIn}
            canSuggest={canInteract}
            viewerBalance={localBalance}
            creationCost={creationCost}
            titleId="game-suggestion-modal-title"
            onRequestClose={() => setIsSuggestModalOpen(false)}
            className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto"
          />
        </div>
      ) : null}
    </div>
  );
}
