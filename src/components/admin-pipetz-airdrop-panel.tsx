"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AdminViewerDirectoryRecord } from "@/lib/types";
import { formatPipetz } from "@/lib/utils";

function buildViewerLabel(entry: AdminViewerDirectoryRecord) {
  return [entry.youtubeDisplayName, entry.youtubeHandle, entry.youtubeChannelId]
    .filter(Boolean)
    .join(" . ");
}

export function AdminPipetzAirdropPanel({
  viewers,
}: {
  viewers: AdminViewerDirectoryRecord[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [viewerIds, setViewerIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("100");
  const [reason, setReason] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const eligibleViewers = useMemo(
    () => viewers.filter((entry) => !entry.isSyntheticYoutubeChannel),
    [viewers],
  );
  const selectedViewers = eligibleViewers.filter((entry) => viewerIds.includes(entry.id));
  const parsedAmount = Number.parseInt(amount, 10);
  const canSubmit =
    selectedViewers.length > 0 &&
    Number.isInteger(parsedAmount) &&
    parsedAmount > 0 &&
    reason.trim().length >= 3 &&
    confirmationText.trim().toUpperCase() === "AIRDROP";

  const matchingViewers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return eligibleViewers;
    }

    return eligibleViewers.filter((entry) =>
      [
        entry.youtubeDisplayName,
        entry.youtubeHandle,
        entry.youtubeChannelId,
        entry.email,
        entry.googleAccountEmail,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    );
  }, [eligibleViewers, query]);
  const visibleViewers = matchingViewers.slice(0, 10);

  function toggleViewer(viewerId: string) {
    setViewerIds((current) =>
      current.includes(viewerId)
        ? current.filter((entry) => entry !== viewerId)
        : [...current, viewerId],
    );
  }

  function toggleFilteredViewers() {
    const matchingIds = matchingViewers.map((entry) => entry.id);
    const hasSelectedAllMatching = matchingIds.every((id) => viewerIds.includes(id));

    setViewerIds((current) => {
      if (hasSelectedAllMatching) {
        return current.filter((id) => !matchingIds.includes(id));
      }

      return [...new Set([...current, ...matchingIds])];
    });
  }

  function submitAirdrop() {
    if (selectedViewers.length === 0 || !canSubmit) {
      setFeedback('Escolha pelo menos um usuário, informe valor e motivo, e confirme com "AIRDROP".');
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/viewers/${selectedViewers[0]!.id}/airdrop`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            viewerIds,
            amount: parsedAmount,
            reason: reason.trim(),
            confirmationText: confirmationText.trim(),
          }),
        });
        const payload = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          setFeedback(payload.error ?? "Falha ao fazer airdrop.");
          return;
        }

        setFeedback(
          `Airdrop de ${formatPipetz(parsedAmount)} pipetz enviado para ${selectedViewers.length} usuário${selectedViewers.length === 1 ? "" : "s"}.`,
        );
        setViewerIds([]);
        setAmount("100");
        setReason("");
        setConfirmationText("");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao fazer airdrop.");
      }
    });
  }

  return (
    <section className="panel surface-section p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl uppercase" style={{ fontFamily: "var(--font-display)" }}>
            Dar pipetz
          </h2>
        </div>
        {feedback ? <div className="retro-label neutral-chip max-w-sm">{feedback}</div> : null}
      </div>

      <div className="mt-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
            Buscar viewer
          </span>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, @handle ou ID do canal"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            onClick={toggleFilteredViewers}
            disabled={matchingViewers.length === 0}
            variant="neutral"
            size="sm"
          >
            {matchingViewers.length > 0 &&
            matchingViewers.every((entry) => viewerIds.includes(entry.id))
              ? "Limpar selecionados"
              : "Selecionar todos"}
          </Button>
          <span className="text-xs font-bold text-[var(--color-ink-soft)]">
            {selectedViewers.length} selecionado{selectedViewers.length === 1 ? "" : "s"} de {matchingViewers.length}
          </span>
        </div>

        <div className="grid max-h-64 gap-2 overflow-auto pr-1">
          {visibleViewers.map((entry) => {
            const isSelected = viewerIds.includes(entry.id);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => toggleViewer(entry.id)}
                className="card-flat grid gap-1 bg-[var(--color-paper)] p-3 text-left text-sm transition hover:-translate-y-0.5"
                style={{
                  outline: isSelected ? "3px solid var(--color-purple-mid)" : undefined,
                }}
              >
                <span className="font-black uppercase text-[var(--color-ink)]">
                  {isSelected ? "[x] " : ""}
                  {entry.youtubeDisplayName}
                </span>
                <span className="truncate text-xs font-bold text-[var(--color-ink-soft)]">
                  {buildViewerLabel(entry)}
                </span>
                <span className="text-xs font-bold text-[var(--color-ink-soft)]">
                  Saldo atual: {entry.currentBalance !== null ? formatPipetz(entry.currentBalance) : "--"} pipetz
                </span>
              </button>
            );
          })}
          {matchingViewers.length > visibleViewers.length ? (
            <p className="text-xs font-bold text-[var(--color-ink-soft)]">
              Mostrando 10 de {matchingViewers.length} viewers encontrados. Selecionar todos inclui todos os {matchingViewers.length}.
            </p>
          ) : null}
          {visibleViewers.length === 0 ? (
            <p className="card-flat bg-[var(--color-paper)] p-3 text-sm font-bold text-[var(--color-ink-soft)]">
              Nenhum viewer encontrado.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <label className="grid gap-2">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
              Pipetz
            </span>
            <Input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
              Motivo
            </span>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: prêmio da live, correção de saldo, evento da comunidade"
              className="min-h-24"
            />
          </label>
        </div>

        <div className="card-flat bg-[var(--color-paper)] p-4">
          <p className="mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
            Revisão
          </p>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            {selectedViewers.length > 0
              ? `${selectedViewers.length} usuário${selectedViewers.length === 1 ? "" : "s"} receber${selectedViewers.length === 1 ? "á" : "ão"} ${Number.isInteger(parsedAmount) && parsedAmount > 0 ? formatPipetz(parsedAmount) : "--"} pipetz cada.`
              : "Escolha pelo menos um viewer para revisar o airdrop."}
          </p>
          {selectedViewers.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedViewers.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => toggleViewer(entry.id)}
                  className="badge-brutal bg-[var(--color-mint)] px-2 py-1 text-[10px] text-[var(--color-accent-ink)]"
                >
                  {entry.youtubeDisplayName} x
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
            Confirmação
          </span>
          <Input
            value={confirmationText}
            onChange={(event) => setConfirmationText(event.target.value)}
            placeholder='Digite "AIRDROP"'
          />
        </label>

        <Button
          type="button"
          onClick={submitAirdrop}
          disabled={isPending || !canSubmit}
          variant="success"
          className="w-full sm:w-fit"
        >
          {isPending ? "Enviando..." : "Fazer airdrop"}
        </Button>
      </div>
    </section>
  );
}
