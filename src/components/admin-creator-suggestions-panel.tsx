"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CreatorPlatform, CreatorSuggestionStatus, CreatorSuggestionWithMeta } from "@/lib/types";
import { formatDateTime, formatPipetz } from "@/lib/utils";

const platformLabels: Record<CreatorPlatform, string> = {
  youtube: "YouTube",
  twitch: "Twitch",
  kick: "Kick",
  other: "Outro",
};

const statusLabels: Record<CreatorSuggestionStatus, string> = {
  open: "Aberta",
  accepted: "Aceita",
  featured: "Em destaque",
  rejected: "Rejeitada",
};

const statusBgMap: Record<CreatorSuggestionStatus, string> = {
  open: "var(--color-sky)",
  accepted: "var(--color-mint)",
  featured: "var(--color-lavender)",
  rejected: "var(--color-rose)",
};

function mapSuggestionError(message: string) {
  switch (message) {
    case "suggestion_not_found":
      return "Indicação não encontrada.";
    case "invalid_youtube_channel_url":
      return "Cole um link de canal do YouTube, como youtube.com/@nome ou youtube.com/channel/ID.";
    case "youtube_api_not_configured":
      return "A busca automática precisa de YOUTUBE_API_KEY configurada.";
    case "youtube_channel_not_found":
      return "Não encontrei esse canal no YouTube.";
    case "suggestion_already_exists":
      return "Esse criador já está cadastrado.";
    default:
      return message;
  }
}

export function AdminCreatorSuggestionsPanel({
  suggestions,
}: {
  suggestions: CreatorSuggestionWithMeta[];
}) {
  const router = useRouter();
  const [channelUrl, setChannelUrl] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function addCreator(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/creator-suggestions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ channelUrl: channelUrl.trim() }),
        });
        const payload = (await response.json()) as { ok: boolean; error?: string };

        if (!response.ok || !payload.ok) {
          setFeedback(mapSuggestionError(payload.error ?? "Falha ao incluir criador."));
          return;
        }

        setChannelUrl("");
        setFeedback("Criador incluído na lista de destaques.");
        router.refresh();
      } catch {
        setFeedback("Falha ao incluir criador.");
      }
    });
  }

  function refreshCreator(suggestion: CreatorSuggestionWithMeta) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/creator-suggestions/${suggestion.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ channelUrl: suggestion.channelUrl }),
        });
        const payload = (await response.json()) as { ok: boolean; error?: string };

        if (!response.ok || !payload.ok) {
          setFeedback(mapSuggestionError(payload.error ?? "Falha ao atualizar criador."));
          return;
        }

        setFeedback(`Dados de ${suggestion.name} atualizados.`);
        router.refresh();
      } catch {
        setFeedback("Falha ao atualizar criador.");
      }
    });
  }

  function deleteSuggestion(suggestion: CreatorSuggestionWithMeta) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/creator-suggestions/${suggestion.id}`, {
          method: "DELETE",
        });
        const payload = (await response.json()) as { ok: boolean; error?: string };

        if (!response.ok || !payload.ok) {
          setFeedback(mapSuggestionError(payload.error ?? "Falha ao excluir indicação."));
          return;
        }

        setConfirmingDeleteId(null);
        setFeedback(`Indicação de ${suggestion.name} excluída.`);
        router.refresh();
      } catch {
        setFeedback("Falha ao excluir indicação.");
      }
    });
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl uppercase" style={{ fontFamily: "var(--font-display)" }}>
            Indicações de criadores
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-ink-soft)]">
            Remova indicações que não devem mais aparecer para a comunidade. Os boosts associados
            são removidos junto com a indicação; os lançamentos de pipetz continuam no histórico.
          </p>
        </div>
        {feedback ? <div className="retro-label neutral-chip">{feedback}</div> : null}
      </div>

      <form onSubmit={addCreator} className="card-brutal-static grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="grid gap-2">
          <span className="text-sm font-black uppercase tracking-[0.14em]">Adicionar criador</span>
          <span className="text-xs leading-5 text-[var(--color-ink-soft)]">
            Cole a URL do canal do YouTube. O nome e o endereço oficial serão preenchidos automaticamente.
          </span>
          <input
            type="url"
            required
            value={channelUrl}
            onChange={(event) => setChannelUrl(event.target.value)}
            placeholder="https://www.youtube.com/@nome"
            className="rounded-[var(--radius)] border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] px-3 py-2 text-sm font-bold outline-none focus-visible:outline-[3px] focus-visible:outline-[var(--color-purple-mid)]"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="btn-brutal bg-[var(--color-mint)] px-4 py-2 text-xs disabled:opacity-60"
        >
          {isPending ? "Buscando canal..." : "Incluir criador"}
        </button>
      </form>

      <div className="grid gap-3">
        {suggestions.length === 0 ? (
          <div className="card-brutal-static p-4 text-sm font-bold text-[var(--color-ink-soft)]">
            Nenhuma indicação de criador cadastrada.
          </div>
        ) : null}

        {suggestions.map((suggestion) => {
          const status = suggestion.status;

          return (
            <article key={suggestion.id} className="card-brutal-static p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold">{suggestion.name}</h3>
                    <span className="badge-brutal bg-[var(--color-paper)] px-2 py-1 text-[10px] text-[var(--color-ink)]">
                      {platformLabels[suggestion.platform]}
                    </span>
                    <span
                      className="badge-brutal px-2 py-1 text-[10px] text-[var(--color-ink)]"
                      style={{ backgroundColor: statusBgMap[status] }}
                    >
                      {statusLabels[status]}
                    </span>
                  </div>
                  <p className="mono mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
                    por {suggestion.suggestedBy} · {formatDateTime(suggestion.createdAt)}
                  </p>
                  {suggestion.reason ? (
                    <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">{suggestion.reason}</p>
                  ) : null}
                </div>

                <span className="retro-label neutral-chip shrink-0">
                  {formatPipetz(suggestion.totalVotes)} pipetz
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--color-ink)] pt-3">
                <a
                  href={suggestion.channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono max-w-full break-all text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:underline"
                >
                  {suggestion.channelUrl}
                </a>

                {confirmingDeleteId === suggestion.id ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em]">
                      Excluir esta indicação?
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(null)}
                      disabled={isPending}
                      className="btn-brutal bg-[var(--color-paper)] px-3 py-2 text-xs disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSuggestion(suggestion)}
                      disabled={isPending}
                      className="btn-brutal bg-[var(--color-rose)] px-3 py-2 text-xs disabled:opacity-60"
                    >
                      {isPending ? "Excluindo..." : "Confirmar exclusão"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-end gap-2">
                    {suggestion.status === "featured" ? (
                      <button
                        type="button"
                        onClick={() => refreshCreator(suggestion)}
                        disabled={isPending}
                        className="btn-brutal bg-[var(--color-paper)] px-3 py-2 text-xs disabled:opacity-60"
                      >
                        {isPending ? "Atualizando..." : "Atualizar dados"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setFeedback(null);
                        setConfirmingDeleteId(suggestion.id);
                      }}
                      disabled={isPending}
                      className="btn-brutal bg-[var(--color-rose)] px-3 py-2 text-xs disabled:opacity-60"
                    >
                      Excluir indicação
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
