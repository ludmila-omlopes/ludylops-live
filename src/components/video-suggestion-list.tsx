"use client";

import { useEffect, useState, useTransition } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { VideoSuggestionCard } from "@/components/video-suggestion-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VIDEO_SUGGESTION_CREATION_COST } from "@/lib/video-suggestions/constants";
import { validateVideoSuggestionDraft } from "@/lib/video-suggestions/service";
import type { VideoSuggestionWithMeta } from "@/lib/types";
import { formatPipetz } from "@/lib/utils";

function mapSuggestionError(message: string, creationCost: number) {
  switch (message) {
    case "saldo_insuficiente":
      return `Você precisa de ${formatPipetz(creationCost)} para criar uma sugestão.`;
    case "suggestion_already_exists":
      return "Esse vídeo já está na lista aberta.";
    case "invalid_youtube_url":
      return "Cole um link válido de vídeo do YouTube.";
    case "youtube_video_not_found":
      return "Não consegui validar esse vídeo no YouTube.";
    default:
      return message;
  }
}

export function VideoSuggestionList({
  suggestions,
  loggedIn = false,
  canInteract = false,
  viewerBalance,
  creationCost = VIDEO_SUGGESTION_CREATION_COST,
}: {
  suggestions: VideoSuggestionWithMeta[];
  loggedIn?: boolean;
  canInteract?: boolean;
  viewerBalance?: number | null;
  creationCost?: number;
}) {
  const router = useRouter();
  const [localSuggestions, setLocalSuggestions] = useState(suggestions);
  const [localBalance, setLocalBalance] = useState<number | null>(
    viewerBalance ?? null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasInsufficientBalance =
    typeof localBalance === "number" && localBalance < creationCost;
  const missingBalance = hasInsufficientBalance
    ? creationCost - (localBalance ?? 0)
    : 0;
  const hasDraft = Boolean(videoUrl || reason);

  useEffect(() => {
    setLocalSuggestions(suggestions);
  }, [suggestions]);

  useEffect(() => {
    setLocalBalance(viewerBalance ?? null);
  }, [viewerBalance]);

  function handleBoostSuccess(
    updatedSuggestion: VideoSuggestionWithMeta,
    spentAmount: number,
  ) {
    setLocalSuggestions((current) =>
      current.map((suggestion) =>
        suggestion.id === updatedSuggestion.id ? updatedSuggestion : suggestion,
      ),
    );

    setLocalBalance((current) =>
      typeof current === "number" ? Math.max(current - spentAmount, 0) : current,
    );
  }

  function clearDraft() {
    setVideoUrl("");
    setReason("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const validationError = validateVideoSuggestionDraft({
      videoUrl,
      reason,
    });

    if (validationError) {
      setFeedback(validationError);
      return;
    }

    if (!canInteract) {
      setFeedback(
        loggedIn
          ? "Sua conta ainda não está pronta para sugerir."
          : "Faça login para sugerir.",
      );
      return;
    }

    if (hasInsufficientBalance) {
      setFeedback(
        `Faltam ${formatPipetz(missingBalance)} para criar uma sugestão.`,
      );
      return;
    }

    setFeedback("Validando vídeo no YouTube...");
    startTransition(async () => {
      try {
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

        const payload = (await response.json()) as {
          ok: boolean;
          error?: string;
          data?: VideoSuggestionWithMeta;
        };

        if (!response.ok || !payload.ok || !payload.data) {
          setFeedback(
            mapSuggestionError(
              payload.error ?? "Falha ao enviar sugestão.",
              creationCost,
            ),
          );
          return;
        }

        setLocalSuggestions((current) => [payload.data!, ...current]);
        setLocalBalance((current) =>
          typeof current === "number"
            ? Math.max(current - creationCost, 0)
            : current,
        );
        clearDraft();
        setFeedback(`Sugestão enviada. ${formatPipetz(creationCost)} debitados.`);
        router.refresh();
      } catch {
        setFeedback("Falha ao enviar sugestão.");
      }
    });
  }

  const sorted = [...localSuggestions].sort((a, b) => {
    if (b.totalVotes !== a.totalVotes) {
      return b.totalVotes - a.totalVotes;
    }

    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });
  const visibleSuggestions = sorted.filter(
    (suggestion) => suggestion.status !== "rejected",
  );
  const openCount = visibleSuggestions.filter(
    (suggestion) => suggestion.status === "open",
  ).length;

  return (
    <div className="grid gap-5">
      <div className="panel surface-section p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <h2
              className="text-2xl font-bold uppercase sm:text-3xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Fila da comunidade
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink-soft)]">
              Envie vídeos que combinam com a live. A fila é ordenada por boost,
              então cada pipetz ajuda a mostrar o que a comunidade quer ver
              primeiro.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-2 border-2 border-[var(--color-ink)] bg-[var(--color-paper)] text-center">
              <div className="border-r-2 border-[var(--color-ink)] px-4 py-2">
                <p
                  className="text-2xl font-bold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {visibleSuggestions.length}
                </p>
                <p className="mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                  na fila
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
            <Button
              type="button"
              onClick={() => {
                setFeedback(null);
                setIsModalOpen(true);
              }}
              variant="accent"
              size="lg"
              className="gap-2"
            >
              <PlusIcon className="size-4" aria-hidden="true" />
              Sugerir vídeo
            </Button>
          </div>
        </div>
      </div>

      {visibleSuggestions.length === 0 ? (
        <div className="panel surface-section p-6 text-sm font-bold text-[var(--color-ink-soft)]">
          Nenhuma sugestão de vídeo publicada ainda.
        </div>
      ) : null}

      <div className="grid gap-4">
        {visibleSuggestions.map((suggestion, index) => (
          <VideoSuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            index={index}
            loggedIn={loggedIn}
            canBoost={canInteract}
            viewerBalance={localBalance}
            onBoostSuccess={handleBoostSuccess}
          />
        ))}
      </div>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-backdrop)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-suggestion-modal-title"
        >
          <form
            onSubmit={handleSubmit}
            className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5 text-[var(--color-ink)] shadow-purple sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="video-suggestion-modal-title"
                  className="text-2xl font-bold uppercase"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Sugerir vídeo
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-ink-soft)]">
                  Cole o link de um vídeo do YouTube. Eu valido o link e busco a
                  thumb, o título e o criador automaticamente.
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="neutral"
                aria-label="Fechar modal"
                onClick={() => setIsModalOpen(false)}
              >
                <XIcon className="size-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="retro-label accent-chip">
                custa {formatPipetz(creationCost)}
              </span>
              {typeof localBalance === "number" ? (
                <span className="retro-label neutral-chip">
                  saldo {formatPipetz(localBalance)}
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3">
              <Input
                type="url"
                placeholder="Link do YouTube"
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                required
                maxLength={500}
                className="border-2"
              />
              <Textarea
                placeholder="Por que eu deveria reagir a esse vídeo? (opcional)"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                maxLength={500}
                className="min-h-28 border-2 font-medium"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                {hasDraft
                  ? "Fechar não apaga o que você digitou nesta sessão."
                  : "Depois de enviado, o vídeo entra na fila para receber boosts."}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="neutral"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                >
                  Fechar
                </Button>
                <Button
                  type="submit"
                  variant="accent"
                  disabled={isPending || hasInsufficientBalance}
                >
                  {isPending
                    ? "Validando..."
                    : `Enviar por ${formatPipetz(creationCost)}`}
                </Button>
              </div>
            </div>

            {!loggedIn ? (
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                Faça login para sugerir vídeos e dar boost.
              </p>
            ) : null}

            {loggedIn && hasInsufficientBalance ? (
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                Faltam {formatPipetz(missingBalance)} para liberar uma nova
                sugestão.
              </p>
            ) : null}

            {feedback ? (
              <div className="sticker sticker-pop accent-chip mt-3 inline-flex px-3 py-1.5 text-sm">
                {feedback}
              </div>
            ) : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}
