"use client";

import { useEffect, useState, useTransition } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { CreatorSuggestionCard } from "@/components/creator-suggestion-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CREATOR_SUGGESTION_CREATION_COST } from "@/lib/creator-suggestions/constants";
import { validateCreatorSuggestionDraft } from "@/lib/creator-suggestions/service";
import type { CreatorPlatform, CreatorSuggestionWithMeta } from "@/lib/types";
import { formatPipetz } from "@/lib/utils";

const platformOptions: Array<{ value: CreatorPlatform; label: string }> = [
  { value: "youtube", label: "YouTube" },
  { value: "twitch", label: "Twitch" },
  { value: "kick", label: "Kick" },
  { value: "other", label: "Outro" },
];

function mapSuggestionError(message: string, creationCost: number) {
  switch (message) {
    case "saldo_insuficiente":
      return `Você precisa de ${formatPipetz(creationCost)} para enviar uma indicação. Junte mais pipetz assistindo e interagindo na live.`;
    case "suggestion_already_exists":
      return "Esse criador já está na lista aberta.";
    case "invalid_creator":
      return "Confira o nome e o link do canal.";
    default:
      return message;
  }
}

export function CreatorSuggestionList({
  suggestions,
  loggedIn = false,
  canInteract = false,
  viewerBalance,
  creationCost = CREATOR_SUGGESTION_CREATION_COST,
}: {
  suggestions: CreatorSuggestionWithMeta[];
  loggedIn?: boolean;
  canInteract?: boolean;
  viewerBalance?: number | null;
  creationCost?: number;
}) {
  const router = useRouter();
  const [localSuggestions, setLocalSuggestions] = useState(suggestions);
  const [localBalance, setLocalBalance] = useState<number | null>(viewerBalance ?? null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [platform, setPlatform] = useState<CreatorPlatform>("youtube");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasInsufficientBalance =
    typeof localBalance === "number" && localBalance < creationCost;
  const missingBalance = hasInsufficientBalance ? creationCost - (localBalance ?? 0) : 0;
  const hasDraft = Boolean(name || channelUrl || category || reason);

  useEffect(() => {
    setLocalSuggestions(suggestions);
  }, [suggestions]);

  useEffect(() => {
    setLocalBalance(viewerBalance ?? null);
  }, [viewerBalance]);

  function handleBoostSuccess(updatedSuggestion: CreatorSuggestionWithMeta, spentAmount: number) {
    setLocalSuggestions((current) =>
      current.map((suggestion) =>
        suggestion.id === updatedSuggestion.id ? updatedSuggestion : suggestion,
      ),
    );

    setLocalBalance((current) =>
      typeof current === "number" ? Math.max(current - spentAmount, 0) : current,
    );
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  function clearDraft() {
    setName("");
    setChannelUrl("");
    setPlatform("youtube");
    setCategory("");
    setReason("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const validationError = validateCreatorSuggestionDraft({
      name,
      channelUrl,
      platform,
      category,
      reason,
    });

    if (validationError) {
      setFeedback(validationError);
      return;
    }

    if (!canInteract) {
      setFeedback(loggedIn ? "Sua conta ainda não está pronta para indicar." : "Faça login para indicar.");
      return;
    }

    if (hasInsufficientBalance) {
      setFeedback(`Faltam ${formatPipetz(missingBalance)} para enviar a indicação.`);
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/me/creator-suggestions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            channelUrl: channelUrl.trim(),
            platform,
            category: category.trim() || undefined,
            reason: reason.trim() || undefined,
          }),
        });

        const payload = (await response.json()) as {
          ok: boolean;
          error?: string;
          data?: CreatorSuggestionWithMeta;
        };

        if (!response.ok || !payload.ok || !payload.data) {
          setFeedback(mapSuggestionError(payload.error ?? "Falha ao enviar indicação.", creationCost));
          return;
        }

        setLocalSuggestions((current) => [payload.data!, ...current]);
        setLocalBalance((current) =>
          typeof current === "number" ? Math.max(current - creationCost, 0) : current,
        );
        clearDraft();
        setFeedback(`Indicação enviada. ${formatPipetz(creationCost)} debitados.`);
        router.refresh();
      } catch {
        setFeedback("Falha ao enviar indicação.");
      }
    });
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
      <div className="panel surface-community-cta p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              className="text-xl font-bold uppercase sm:text-2xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Inspirações da comunidade
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink-soft)]">
              Enviar uma indicação custa {formatPipetz(creationCost)}. A comunidade pode dar boost a qualquer momento; mais boosts aumentam a prioridade na lista.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setFeedback(null);
              setIsModalOpen(true);
            }}
            variant="accent"
            className="gap-2"
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            Indicar criador
          </Button>
        </div>
      </div>

      {visibleSuggestions.length === 0 ? (
        <div className="panel surface-section p-6 text-sm font-bold text-[var(--color-ink-soft)]">
          Nenhuma indicação da comunidade ainda.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {visibleSuggestions.map((suggestion) => (
          <CreatorSuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
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
          aria-labelledby="creator-suggestion-modal-title"
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-2xl border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5 text-[var(--color-ink)] shadow-purple sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="creator-suggestion-modal-title"
                  className="text-2xl font-bold uppercase"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Indicar streamer ou YouTuber
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-ink-soft)]">
                  Campos obrigatórios: nome, link do canal e plataforma. O envio debita {formatPipetz(creationCost)} e a indicação fica aberta para boosts.
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="neutral"
                aria-label="Fechar modal"
                onClick={closeModal}
              >
                <XIcon className="size-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="retro-label accent-chip !rounded-none !border !shadow-none">
                custa {formatPipetz(creationCost)}
              </span>
              {typeof localBalance === "number" ? (
                <span className="retro-label neutral-chip !rounded-none !border !shadow-none">
                  saldo {formatPipetz(localBalance)}
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3">
              <Input
                type="text"
                placeholder="Nome do criador"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={120}
                className="border-2"
              />
              <Input
                type="url"
                placeholder="Link do canal ou perfil"
                value={channelUrl}
                onChange={(event) => setChannelUrl(event.target.value)}
                required
                maxLength={500}
                className="border-2"
              />
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <select
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value as CreatorPlatform)}
                  className="h-11 rounded-[var(--radius)] border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] px-3 text-sm font-bold text-[var(--color-ink)] outline-none focus-visible:outline-[3px] focus-visible:outline-[var(--color-purple-mid)]"
                  required
                >
                  {platformOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Input
                  type="text"
                  placeholder="Categoria ou tipo de conteúdo (opcional)"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  maxLength={120}
                  className="border-2"
                />
              </div>
              <Textarea
                placeholder="Por que a live ou o canal vale a indicação? (opcional)"
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
                  : "Boosts futuros ajudam essa indicação a subir na prioridade."}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="neutral" onClick={closeModal} disabled={isPending}>
                  Fechar
                </Button>
                <Button
                  type="submit"
                  variant="accent"
                  disabled={isPending || hasInsufficientBalance}
                >
                  {isPending ? "Enviando..." : `Enviar por ${formatPipetz(creationCost)}`}
                </Button>
              </div>
            </div>

            {loggedIn && hasInsufficientBalance ? (
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                faltam {formatPipetz(missingBalance)} para liberar uma nova indicação
              </p>
            ) : null}

            {!loggedIn ? (
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                faça login para indicar criadores
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
