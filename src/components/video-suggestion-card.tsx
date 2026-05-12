"use client";

import { useState, useTransition } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VideoSuggestionWithMeta } from "@/lib/types";
import { formatPipetz } from "@/lib/utils";

const statusLabels: Record<VideoSuggestionWithMeta["status"], string> = {
  open: "Aberta",
  accepted: "Aceita",
  reacted: "Ja reagi",
  rejected: "Fechada",
};

const statusColors: Record<VideoSuggestionWithMeta["status"], string> = {
  open: "var(--color-sky)",
  accepted: "var(--color-mint)",
  reacted: "var(--color-lavender)",
  rejected: "var(--color-periwinkle)",
};

const cardBgCycle = [
  "surface-card",
  "surface-card-alt",
  "surface-card-accent",
  "surface-card",
  "surface-card-alt",
  "surface-card",
];

function mapSuggestionError(message: string) {
  switch (message) {
    case "saldo_insuficiente":
      return "Saldo insuficiente.";
    case "suggestion_not_found":
      return "Sugestao nao encontrada.";
    case "suggestion_not_open":
      return "So da para dar boost em sugestoes abertas.";
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
  onBoostSuccess?: (suggestion: VideoSuggestionWithMeta, spentAmount: number) => void;
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
      setFeedback(loggedIn ? "Sua conta ainda nao esta pronta para dar boost." : "Faca login para dar boost.");
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/me/video-suggestions/${suggestion.id}/boost`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ amount: parsed }),
        });

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

  const bgClass = cardBgCycle[index % cardBgCycle.length];

  return (
    <div className={`card-brutal relative overflow-hidden p-5 ${bgClass}`}>
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <a
          href={suggestion.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-[var(--radius)] border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] shadow-purple"
        >
          <Image
            src={suggestion.thumbnailUrl}
            alt=""
            width={480}
            height={360}
            className="aspect-video w-full object-cover"
            loading="lazy"
          />
        </a>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  className="min-w-0 text-xl font-bold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  <a href={suggestion.videoUrl} target="_blank" rel="noreferrer" className="break-words hover:underline">
                    {suggestion.title}
                  </a>
                </h3>
                <span
                  className="sticker micro-flat px-2 py-0.5 text-[10px] text-[var(--color-ink)]"
                  style={{ backgroundColor: statusColors[suggestion.status] }}
                >
                  {statusLabels[suggestion.status]}
                </span>
              </div>
              <p className="mono mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                {suggestion.creatorName}
              </p>
              {suggestion.reason ? (
                <p className="mt-2 text-sm opacity-80">
                  {suggestion.reason}
                </p>
              ) : null}
              <p className="mono mt-2 text-xs opacity-75">
                Sugerido por {suggestion.suggestedBy}
              </p>
              {suggestion.viewerBoostTotal > 0 ? (
                <p className="mono mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                  seu boost: {formatPipetz(suggestion.viewerBoostTotal)}
                </p>
              ) : null}
            </div>

            <div className="micro-flat rounded-[var(--radius)] border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] px-4 py-2 text-center shadow-purple">
              <p
                className="text-2xl font-bold text-[var(--color-purple-bold)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {formatPipetz(suggestion.totalVotes)}
              </p>
              <p className="mono text-[9px] uppercase tracking-[0.15em] text-[var(--color-ink-soft)]">
                boost total
              </p>
              {typeof viewerBalance === "number" ? (
                <p className="mono mt-1 text-[9px] uppercase tracking-[0.15em] text-[var(--color-ink-soft)]">
                  saldo {formatPipetz(viewerBalance)}
                </p>
              ) : null}
            </div>
          </div>

          {suggestion.status === "open" ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border-2 border-dashed border-[var(--color-ink)] bg-[var(--color-paper)]/60 p-3">
              <span className="text-xs font-bold uppercase text-[var(--color-ink-soft)]">Boost:</span>
              <Input
                type="number"
                min="1"
                placeholder="Pipetz"
                value={boostAmount}
                onChange={(e) => setBoostAmount(e.target.value)}
                className="w-24 px-3 py-2"
              />
              <Button
                type="button"
                onClick={handleBoost}
                disabled={isPending}
                size="sm"
              >
                {isPending ? "Enviando..." : "Dar boost"}
              </Button>
            </div>
          ) : null}

          {!loggedIn ? (
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
              faca login para sugerir e dar boost
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
  );
}
