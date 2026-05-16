"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ExternalLinkIcon, PlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VideoSuggestionWithMeta } from "@/lib/types";
import { formatPipetz } from "@/lib/utils";

const statusLabels: Record<VideoSuggestionWithMeta["status"], string> = {
  open: "Aberta",
  accepted: "Já reagi",
  reacted: "Já reagi",
  rejected: "Fechada",
};

const statusColors: Record<VideoSuggestionWithMeta["status"], string> = {
  open: "bg-[var(--color-sky)]",
  accepted: "bg-[var(--color-lavender)]",
  reacted: "bg-[var(--color-lavender)]",
  rejected: "bg-[var(--color-periwinkle)]",
};

function mapSuggestionError(message: string) {
  switch (message) {
    case "saldo_insuficiente":
      return "Saldo insuficiente.";
    case "suggestion_not_found":
      return "Sugestão não encontrada.";
    case "suggestion_not_open":
      return "Só dá para dar boost em sugestões abertas.";
    case "invalid_amount":
      return "Digite um valor inteiro positivo.";
    default:
      return message;
  }
}

export function VideoSuggestionCard({
  suggestion,
  index = 0,
  loggedIn = false,
  canBoost = false,
  viewerBalance,
  onBoostSuccess,
}: {
  suggestion: VideoSuggestionWithMeta;
  index?: number;
  loggedIn?: boolean;
  canBoost?: boolean;
  viewerBalance?: number | null;
  onBoostSuccess?: (
    suggestion: VideoSuggestionWithMeta,
    spentAmount: number,
  ) => void;
}) {
  const [boostAmount, setBoostAmount] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleBoost() {
    const parsed = Number.parseInt(boostAmount, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setFeedback("Digite um valor inteiro positivo.");
      return;
    }

    if (!canBoost) {
      setFeedback(
        loggedIn
          ? "Sua conta ainda não está pronta para dar boost."
          : "Faça login para dar boost.",
      );
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/me/video-suggestions/${suggestion.id}/boost`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ amount: parsed }),
          },
        );

        const payload = (await response.json()) as {
          ok: boolean;
          error?: string;
          data?: VideoSuggestionWithMeta;
        };

        if (!response.ok || !payload.ok || !payload.data) {
          setFeedback(mapSuggestionError(payload.error ?? "Falha ao dar boost."));
          return;
        }

        onBoostSuccess?.(payload.data, parsed);
        setBoostAmount("");
        setFeedback("Boost enviado.");
      } catch {
        setFeedback("Falha ao dar boost.");
      }
    });
  }

  const rankLabel = `#${index + 1}`;

  return (
    <article className="card-brutal overflow-hidden bg-[var(--color-paper)]">
      <div className="grid gap-0 lg:grid-cols-[minmax(320px,42%)_1fr]">
        <a
          href={suggestion.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="group relative block aspect-video border-b-[3px] border-[var(--color-ink)] bg-[var(--color-ink)] lg:border-b-0 lg:border-r-[3px]"
          aria-label={`Abrir vídeo ${suggestion.title} no YouTube`}
        >
          <Image
            src={suggestion.thumbnailUrl}
            alt=""
            width={1280}
            height={720}
            className="h-full w-full object-cover"
            loading={index === 0 ? undefined : "lazy"}
            priority={index === 0}
            sizes="(min-width: 1024px) 42vw, 100vw"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
            <span className="grid size-14 place-items-center border-2 border-white bg-black/70 text-white">
              <PlayIcon className="ml-0.5 size-7 fill-current" aria-hidden="true" />
            </span>
          </span>
          <span className="absolute left-3 top-3 border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-3 py-1 text-sm font-bold">
            {rankLabel}
          </span>
        </a>

        <div className="flex min-w-0 flex-col p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`retro-label ${statusColors[suggestion.status]}`}
                >
                  {statusLabels[suggestion.status]}
                </span>
                <span className="mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                  {suggestion.creatorName}
                </span>
              </div>
              <h3
                className="mt-3 text-2xl font-bold leading-tight sm:text-3xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <a
                  href={suggestion.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-words hover:underline"
                >
                  {suggestion.title}
                </a>
              </h3>
              {suggestion.reason ? (
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-ink-soft)]">
                  {suggestion.reason}
                </p>
              ) : null}
              <p className="mono mt-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                Sugerido por {suggestion.suggestedBy}
              </p>
            </div>

            <div className="grid min-w-[148px] border-2 border-[var(--color-ink)] bg-[var(--color-paper)] text-center">
              <div className="px-4 py-3">
                <p
                  className="text-3xl font-bold text-[var(--color-purple-bold)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {formatPipetz(suggestion.totalVotes)}
                </p>
                <p className="mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                  boost total
                </p>
              </div>
              {suggestion.viewerBoostTotal > 0 ? (
                <div className="border-t-2 border-[var(--color-ink)] px-4 py-2">
                  <p className="mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                    seu boost
                  </p>
                  <p className="text-sm font-bold">
                    {formatPipetz(suggestion.viewerBoostTotal)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-auto pt-5">
            {suggestion.status === "open" ? (
              <div className="flex flex-col gap-3 border-t-2 border-[var(--color-ink)] pt-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase text-[var(--color-ink-soft)]">
                    Dar boost
                  </p>
                  {typeof viewerBalance === "number" ? (
                    <p className="mono mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                      saldo {formatPipetz(viewerBalance)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Pipetz"
                    value={boostAmount}
                    onChange={(event) => setBoostAmount(event.target.value)}
                    className="w-28 border-2 px-3 py-2"
                  />
                  <Button
                    type="button"
                    onClick={handleBoost}
                    disabled={isPending}
                    size="sm"
                  >
                    {isPending ? "Enviando..." : "Boost"}
                  </Button>
                  <a
                    href={suggestion.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-brutal inline-flex items-center justify-center gap-2 bg-[var(--color-paper)] px-4 py-2 text-xs text-[var(--color-ink)]"
                  >
                    <ExternalLinkIcon className="size-4" aria-hidden="true" />
                    Abrir
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--color-ink)] pt-4">
                <p className="text-sm font-bold uppercase text-[var(--color-ink-soft)]">
                  Boost encerrado para este vídeo.
                </p>
                <a
                  href={suggestion.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-brutal inline-flex items-center justify-center gap-2 bg-[var(--color-paper)] px-4 py-2 text-xs text-[var(--color-ink)]"
                >
                  <ExternalLinkIcon className="size-4" aria-hidden="true" />
                  Abrir vídeo
                </a>
              </div>
            )}

            {!loggedIn ? (
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                Faça login para sugerir e dar boost.
              </p>
            ) : null}

            {feedback ? (
              <div className="sticker sticker-pop accent-chip mt-3 inline-flex px-2 py-1 text-xs">
                {feedback}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
