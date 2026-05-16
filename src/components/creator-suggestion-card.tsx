"use client";

import { useState, useTransition } from "react";
import { ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CreatorSuggestionWithMeta } from "@/lib/types";
import { formatPipetz } from "@/lib/utils";

const platformLabels: Record<CreatorSuggestionWithMeta["platform"], string> = {
  youtube: "YouTube",
  twitch: "Twitch",
  kick: "Kick",
  other: "Outro",
};

function getCreatorAvatarUrl(suggestion: CreatorSuggestionWithMeta) {
  let username = "";
  try {
    const url = new URL(suggestion.channelUrl);
    const pathParts = url.pathname.split("/").filter(Boolean);
    username = pathParts[pathParts.length - 1]?.replace(/^@/, "") ?? "";
  } catch {
    username = "";
  }

  if (username && suggestion.platform === "youtube") {
    return `https://unavatar.io/youtube/${encodeURIComponent(username)}`;
  }

  if (username && suggestion.platform === "twitch") {
    return `https://unavatar.io/twitch/${encodeURIComponent(username)}`;
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(suggestion.name)}&background=7dd3fc&color=111111&bold=true`;
}

function mapSuggestionError(message: string) {
  switch (message) {
    case "saldo_insuficiente":
      return "Saldo insuficiente para esse boost.";
    case "suggestion_not_found":
      return "Indicação não encontrada.";
    case "suggestion_not_open":
      return "Só dá para dar boost em indicações abertas.";
    case "invalid_amount":
      return "Digite um valor inteiro positivo.";
    default:
      return message;
  }
}

export function CreatorSuggestionCard({
  suggestion,
  loggedIn = false,
  canBoost = false,
  onBoostSuccess,
}: {
  suggestion: CreatorSuggestionWithMeta;
  loggedIn?: boolean;
  canBoost?: boolean;
  viewerBalance?: number | null;
  onBoostSuccess?: (suggestion: CreatorSuggestionWithMeta, spentAmount: number) => void;
}) {
  const [boostAmount, setBoostAmount] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const avatarUrl = getCreatorAvatarUrl(suggestion);

  function handleBoost() {
    const parsed = Number.parseInt(boostAmount, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setFeedback("Digite um valor inteiro positivo.");
      return;
    }

    if (!canBoost) {
      setFeedback(loggedIn ? "Sua conta ainda não está pronta para dar boost." : "Faça login para dar boost.");
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/me/creator-suggestions/${suggestion.id}/boost`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ amount: parsed }),
        });

        const payload = (await response.json()) as {
          ok: boolean;
          error?: string;
          data?: CreatorSuggestionWithMeta;
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

  return (
    <article className="card-brutal flex h-full flex-col bg-[var(--color-paper)] p-4 sm:p-5">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt={`Foto de perfil de ${suggestion.name}`}
            className="size-16 shrink-0 border-2 border-[var(--color-ink)] object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="retro-label bg-[var(--color-mint)] text-[var(--color-ink)]">
                {platformLabels[suggestion.platform]}
              </span>
            </div>

            <h3
              className="mt-3 text-xl font-bold leading-none sm:text-2xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {suggestion.name}
            </h3>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-4">
          <div>
            {suggestion.reason ? (
              <p className="text-sm leading-6 text-[var(--color-ink-soft)]">
              {suggestion.reason}
              </p>
            ) : null}

            <p className="mono mt-3 text-xs text-[var(--color-ink-soft)]">
              Indicado por {suggestion.suggestedBy}
            </p>
            {suggestion.viewerBoostTotal > 0 ? (
              <p className="mono mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                seu boost: {formatPipetz(suggestion.viewerBoostTotal)}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t-2 border-[var(--color-ink)] pt-3">
            <p
              className="text-3xl font-bold leading-none text-[var(--color-purple-bold)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {formatPipetz(suggestion.totalVotes)}
            </p>
            <a
              href={suggestion.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-brutal inline-flex items-center justify-center gap-2 bg-[var(--color-paper)] px-4 py-2 text-xs text-[var(--color-ink)]"
            >
              <ExternalLinkIcon className="size-4" aria-hidden="true" />
              Abrir canal
            </a>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-[var(--color-ink)] pt-4">
        <span className="mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
          Boost aumenta a prioridade e deixa a indicação mais visível.
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min="1"
            placeholder="Pipetz"
            value={boostAmount}
            onChange={(e) => setBoostAmount(e.target.value)}
            className="h-10 w-24 border-2 px-3 py-2 text-xs"
          />
          <Button
            type="button"
            onClick={handleBoost}
            disabled={isPending}
            size="xs"
            variant="accent"
          >
            {isPending ? "Enviando..." : "Boost"}
          </Button>
        </div>
      </div>

      {!loggedIn ? (
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
          faça login para indicar e dar boost
        </p>
      ) : null}

      {feedback ? (
        <div className="sticker sticker-pop accent-chip mt-3 inline-flex px-2 py-1 text-xs">
          {feedback}
        </div>
      ) : null}
    </article>
  );
}
