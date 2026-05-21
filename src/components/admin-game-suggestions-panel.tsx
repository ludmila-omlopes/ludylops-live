"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { GameSuggestionWithMeta } from "@/lib/types";
import { formatDateTime, formatPipetz } from "@/lib/utils";

const statusLabels: Record<GameSuggestionWithMeta["status"], string> = {
  open: "Aberta",
  accepted: "Aceita",
  played: "Jogada",
  rejected: "Rejeitada",
};

const statusBgMap: Record<GameSuggestionWithMeta["status"], string> = {
  open: "var(--color-sky)",
  accepted: "var(--color-mint)",
  played: "var(--color-lavender)",
  rejected: "var(--color-periwinkle)",
};

const INITIAL_VISIBLE_GAME_SUGGESTIONS = 6;

function mapSuggestionError(message: string) {
  switch (message) {
    case "suggestion_not_found":
      return "Sugestão não encontrada.";
    default:
      return message;
  }
}

export function AdminGameSuggestionsPanel({
  suggestions,
}: {
  suggestions: GameSuggestionWithMeta[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const visibleSuggestions = showAllSuggestions
    ? suggestions
    : suggestions.slice(0, INITIAL_VISIBLE_GAME_SUGGESTIONS);
  const hiddenSuggestionCount = Math.max(suggestions.length - visibleSuggestions.length, 0);

  function submitStatus(suggestionId: string, status: GameSuggestionWithMeta["status"]) {
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/game-suggestions/${suggestionId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setFeedback(mapSuggestionError(payload.error ?? "Falha ao atualizar sugestão."));
        return;
      }

      setFeedback("Status atualizado.");
      router.refresh();
    });
  }

  return (
    <section className="landing-plane landing-divider bg-[var(--color-paper-pink)] py-8 sm:py-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
            Jogos
          </p>
          <h2
            className="mt-2 text-3xl uppercase"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Fila de sugestões
          </h2>
        </div>
        {feedback ? (
          <div className="retro-label neutral-chip">
            {feedback}
          </div>
        ) : null}
      </div>

        <div className="mt-6 grid gap-3">
        {suggestions.length === 0 ? (
          <div className="card-brutal-static p-4 text-sm font-bold text-[var(--color-ink-soft)]">
            Nenhuma sugestão cadastrada.
          </div>
        ) : null}

        {visibleSuggestions.map((suggestion) => (
          <article key={suggestion.id} className="card-brutal-static p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-bold">{suggestion.name}</p>
                  <span
                    className="badge-brutal px-2 py-1 text-[10px] text-[var(--color-ink)]"
                    style={{ backgroundColor: statusBgMap[suggestion.status] }}
                  >
                    {statusLabels[suggestion.status]}
                  </span>
                </div>
                {suggestion.description ? (
                  <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                    {suggestion.description}
                  </p>
                ) : null}
                <p className="mono mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
                  por {suggestion.suggestedBy} . {formatDateTime(suggestion.createdAt)}
                </p>
              </div>

              <span className="retro-label neutral-chip">
                {formatPipetz(suggestion.totalVotes)}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {suggestion.status !== "accepted" ? (
                <Button
                  type="button"
                  onClick={() => submitStatus(suggestion.id, "accepted")}
                  disabled={isPending}
                  variant="success"
                  size="sm"
                >
                  Aceitar
                </Button>
              ) : null}
              {suggestion.status !== "played" ? (
                <Button
                  type="button"
                  onClick={() => submitStatus(suggestion.id, "played")}
                  disabled={isPending}
                  variant="neutral"
                  size="sm"
                >
                  Marcar jogado
                </Button>
              ) : null}
              {suggestion.status !== "rejected" ? (
                <Button
                  type="button"
                  onClick={() => submitStatus(suggestion.id, "rejected")}
                  disabled={isPending}
                  variant="danger"
                  size="sm"
                >
                  Rejeitar
                </Button>
              ) : null}
              {suggestion.status !== "open" ? (
                <Button
                  type="button"
                  onClick={() => submitStatus(suggestion.id, "open")}
                  disabled={isPending}
                  variant="info"
                  size="sm"
                >
                  Reabrir
                </Button>
              ) : null}
            </div>
          </article>
        ))}
        {hiddenSuggestionCount > 0 || showAllSuggestions ? (
          <div className="card-brutal-static flex justify-center p-4">
            <Button
              type="button"
              onClick={() => setShowAllSuggestions((current) => !current)}
              variant="neutral"
              size="sm"
            >
              {showAllSuggestions ? "Ver menos" : `Ver mais ${hiddenSuggestionCount}`}
            </Button>
          </div>
        ) : null}
        </div>
      </div>
    </section>
  );
}
