"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VIDEO_SUGGESTION_CREATION_COST } from "@/lib/video-suggestions/constants";
import { validateVideoSuggestionDraft } from "@/lib/video-suggestions/service";
import { formatPipetz } from "@/lib/utils";

function mapSuggestionError(message: string, creationCost: number) {
  switch (message) {
    case "saldo_insuficiente":
      return `Voce precisa de ${formatPipetz(creationCost)} para criar uma sugestao.`;
    case "suggestion_already_exists":
      return "Esse video ja esta na lista aberta.";
    case "invalid_youtube_url":
      return "Cole um link valido de video do YouTube.";
    case "youtube_video_not_found":
      return "Nao consegui validar esse video no YouTube.";
    default:
      return message;
  }
}

export function VideoSuggestForm({
  loggedIn = false,
  canSuggest = false,
  viewerBalance,
  creationCost = VIDEO_SUGGESTION_CREATION_COST,
}: {
  loggedIn?: boolean;
  canSuggest?: boolean;
  viewerBalance?: number | null;
  creationCost?: number;
}) {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasInsufficientBalance =
    typeof viewerBalance === "number" && viewerBalance < creationCost;
  const missingBalance = hasInsufficientBalance
    ? creationCost - (viewerBalance ?? 0)
    : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateVideoSuggestionDraft({
      videoUrl,
      reason,
    });

    if (validationError) {
      setFeedback(validationError);
      return;
    }

    if (!canSuggest) {
      setFeedback(loggedIn ? "Sua conta ainda nao esta pronta para sugerir." : "Faca login para sugerir.");
      return;
    }

    if (hasInsufficientBalance) {
      setFeedback(`Faltam ${formatPipetz(missingBalance)} para criar uma sugestao.`);
      return;
    }

    setFeedback("Validando video no YouTube...");
    startTransition(async () => {
      const response = await fetch("/api/me/video-suggestions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          videoUrl: videoUrl.trim(),
          reason: reason.trim(),
        }),
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setFeedback(mapSuggestionError(payload.error ?? "Falha ao enviar sugestao.", creationCost));
        return;
      }

      setVideoUrl("");
      setReason("");
      setFeedback(`Sugestao enviada. ${formatPipetz(creationCost)} debitados.`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="panel surface-section relative overflow-hidden p-5 text-[var(--color-ink)] sm:p-6"
    >
      <div className="bg-dots-light pointer-events-none absolute inset-0 opacity-15" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3
              className="text-lg font-bold uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Sugira um video
            </h3>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              Manda o link do YouTube e me convence a reagir ao vivo.
            </p>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
              cada nova sugestao custa {formatPipetz(creationCost)}. boost continua separado.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="retro-label accent-chip">
              custa {formatPipetz(creationCost)}
            </span>
            {typeof viewerBalance === "number" ? (
              <span className="retro-label neutral-chip">
                saldo {formatPipetz(viewerBalance)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <Input
            type="url"
            placeholder="Link do YouTube"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            required
            maxLength={500}
          />
          <Textarea
            placeholder="Por que eu deveria reagir a esse video? (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={500}
            className="min-h-28 font-medium"
          />
          <Button
            type="submit"
            disabled={isPending || hasInsufficientBalance}
            size="lg"
            className="w-full sm:w-fit"
          >
            {isPending
              ? "Validando..."
              : `Enviar sugestao por ${formatPipetz(creationCost)}`}
          </Button>
        </div>

        {!loggedIn ? (
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
            faca login para sugerir e dar boost
          </p>
        ) : null}

        {loggedIn && hasInsufficientBalance ? (
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
            faltam {formatPipetz(missingBalance)} para liberar uma nova sugestao
          </p>
        ) : null}

        {feedback ? (
          <div className="sticker sticker-pop accent-chip mt-3 inline-flex px-3 py-1.5 text-sm">
            {feedback}
          </div>
        ) : null}
      </div>
    </form>
  );
}
