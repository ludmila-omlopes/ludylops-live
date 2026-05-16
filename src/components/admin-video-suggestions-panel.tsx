"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { VideoSuggestionWithMeta } from "@/lib/types";
import {
  getVideoSuggestionAdminActions,
  normalizeVideoSuggestionStatus,
  type AdminVideoSuggestionStatus,
} from "@/lib/video-suggestions/admin-actions";
import { formatDateTime, formatPipetz } from "@/lib/utils";

const statusLabels: Record<AdminVideoSuggestionStatus, string> = {
  open: "Aberta",
  reacted: "Reagida",
  rejected: "Rejeitada",
};

const statusBgMap: Record<AdminVideoSuggestionStatus, string> = {
  open: "var(--color-sky)",
  reacted: "var(--color-lavender)",
  rejected: "var(--color-periwinkle)",
};

function mapSuggestionError(message: string) {
  switch (message) {
    case "suggestion_not_found":
      return "Sugestão não encontrada.";
    default:
      return message;
  }
}

export function AdminVideoSuggestionsPanel({
  suggestions,
}: {
  suggestions: VideoSuggestionWithMeta[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitStatus(suggestionId: string, status: AdminVideoSuggestionStatus) {
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/video-suggestions/${suggestionId}`, {
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
    <section className="landing-plane landing-divider bg-[var(--color-sky)] py-8 sm:py-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mono text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
              Vídeos
            </p>
            <h2
              className="mt-2 text-3xl uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Fila de reações
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

          {suggestions.map((suggestion) => {
            const normalizedStatus = normalizeVideoSuggestionStatus(suggestion.status);
            const actions = getVideoSuggestionAdminActions(suggestion.status);

            return (
              <article key={suggestion.id} className="card-brutal-static p-4">
                <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                  <a
                    href={suggestion.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-[var(--radius)] border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)]"
                  >
                    <Image
                      src={suggestion.thumbnailUrl}
                      alt=""
                      width={480}
                      height={360}
                      className="aspect-video w-full object-cover"
                    />
                  </a>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-bold">
                            <a
                              href={suggestion.videoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="break-words hover:underline"
                            >
                              {suggestion.title}
                            </a>
                          </p>
                          <span
                            className="badge-brutal px-2 py-1 text-[10px] text-[var(--color-ink)]"
                            style={{ backgroundColor: statusBgMap[normalizedStatus] }}
                          >
                            {statusLabels[normalizedStatus]}
                          </span>
                        </div>
                        <p className="mono mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
                          {suggestion.creatorName}
                        </p>
                        {suggestion.reason ? (
                          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                            {suggestion.reason}
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
                      {actions.map((action) => (
                        <Button
                          key={action.id}
                          type="button"
                          onClick={() => submitStatus(suggestion.id, action.targetStatus)}
                          disabled={isPending}
                          variant={action.variant}
                          size="sm"
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
