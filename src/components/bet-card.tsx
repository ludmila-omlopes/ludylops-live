"use client";

import { type FormEvent, useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Ban, CheckCircle2, Clock3, Lock, Radio, Send, Trophy, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BetStatus, BetWithOptionsRecord } from "@/lib/types";
import { cn, formatPipetz } from "@/lib/utils";

function mapError(message: string) {
  switch (message) {
    case "saldo_insuficiente":
      return "Saldo insuficiente. Aposte um valor menor ou junte mais pipetz.";
    case "aposta_ja_registrada":
      return "Você já apostou nesta rodada.";
    case "bet_not_open":
      return "A aposta não está aberta. Atualize a página para ver o estado mais recente.";
    case "bet_closed":
      return "A janela de aposta já fechou. Atualize a página para ver o resultado.";
    case "invalid_option":
      return "Opção inválida. Escolha uma opção disponível.";
    case "invalid_amount":
      return "Valor inválido. Digite um número inteiro de pipetz.";
    default:
      return message;
  }
}

type StatusMeta = {
  label: string;
  Icon: LucideIcon;
  className: string;
};

const statusMeta: Record<BetStatus, StatusMeta> = {
  draft: {
    label: "Rascunho",
    Icon: Clock3,
    className: "bg-[var(--color-paper)] text-[var(--color-ink)]",
  },
  open: {
    label: "Aberta",
    Icon: Radio,
    className: "bg-[var(--color-mint)] text-[var(--color-accent-ink)]",
  },
  locked: {
    label: "Travada",
    Icon: Lock,
    className: "bg-[var(--color-yellow)] text-[var(--color-accent-ink)]",
  },
  resolved: {
    label: "Resolvida",
    Icon: Trophy,
    className: "bg-[var(--color-purple)] text-[var(--color-accent-ink)]",
  },
  cancelled: {
    label: "Cancelada",
    Icon: Ban,
    className: "bg-[var(--color-rose)] text-[var(--color-ink)]",
  },
};

const closedStatusMeta: StatusMeta = {
  label: "Fechada",
  Icon: Lock,
  className: "bg-[var(--color-yellow)] text-[var(--color-accent-ink)]",
};

const optionColors = [
  "var(--color-blue)",
  "var(--color-purple)",
  "var(--color-pink)",
  "var(--color-mint)",
  "var(--color-periwinkle)",
  "var(--color-yellow)",
];

const optionBackgrounds = [
  "bg-[var(--color-paper)]",
  "bg-[var(--surface-card-alt)]",
  "bg-[var(--surface-card-accent)]",
  "bg-[var(--color-sky)]",
];

function formatBetDeadline(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatRemaining(closesAt: string, nowMs: number | null) {
  if (nowMs === null) {
    return "Atualizando…";
  }

  const remainingMinutes = Math.ceil((new Date(closesAt).getTime() - nowMs) / 60_000);
  if (remainingMinutes <= 0) {
    return "Janela fechada";
  }
  if (remainingMinutes < 60) {
    return `${remainingMinutes} min restantes`;
  }

  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return minutes > 0 ? `${hours} h ${minutes} min restantes` : `${hours} h restantes`;
}

export function BetCard({
  bet,
  viewerBalance,
  loggedIn = false,
  canBet = false,
}: {
  bet: BetWithOptionsRecord;
  viewerBalance?: number | null;
  loggedIn?: boolean;
  canBet?: boolean;
}) {
  const router = useRouter();
  const amountId = useId();
  const freeformOptionId = `${amountId}-option`;
  const feedbackId = `${amountId}-feedback`;
  const [draftSelectedOption, setDraftSelectedOption] = useState<string | null>(null);
  const [freeformOption, setFreeformOption] = useState("");
  const [amount, setAmount] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (bet.status !== "open") {
      return;
    }

    const updateNow = () => {
      setNowMs(Date.now());
    };
    const timeoutId = window.setTimeout(updateNow, 0);
    const intervalId = window.setInterval(updateNow, 30_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [bet.status]);

  const closesAtMs = new Date(bet.closesAt).getTime();
  const isOpen = bet.status === "open" && (nowMs === null || closesAtMs > nowMs);
  const isResolved = bet.status === "resolved";
  const isCancelled = bet.status === "cancelled";
  const isFreeformBet = bet.optionMode === "freeform";
  const hasViewerBet = Boolean(bet.viewerPosition);
  const selectedOption = bet.viewerPosition?.optionId ?? draftSelectedOption;
  const selectedOptionLabel =
    bet.options.find((option) => option.id === selectedOption)?.label ?? "opção selecionada";
  const viewerPositionLabel =
    bet.options.find((option) => option.id === bet.viewerPosition?.optionId)?.label ?? "opção";
  const totalPool = bet.totalPool || bet.options.reduce((sum, option) => sum + option.poolAmount, 0);
  const displayStatus = bet.status === "open" && !isOpen ? closedStatusMeta : statusMeta[bet.status];
  const StatusIcon = displayStatus.Icon;
  const canSelectOption = isOpen && canBet && !hasViewerBet && !isFreeformBet;
  const canAddToExistingBet = isOpen && canBet && hasViewerBet;
  const showAmountForm = isOpen && canBet && (isFreeformBet || Boolean(selectedOption));
  const cardBackground = isCancelled
    ? "var(--color-rose)"
    : isResolved
      ? "var(--color-lilac)"
      : "var(--color-paper)";

  function handlePlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedAmount = amount.trim();
    const parsed = Number.parseInt(normalizedAmount, 10);
    const normalizedFreeformOption = freeformOption.trim().replace(/\s+/g, " ");
    if (!isFreeformBet && !selectedOption) {
      setFeedback("Escolha uma opção antes de apostar.");
      return;
    }
    if (isFreeformBet && !hasViewerBet && normalizedFreeformOption.length === 0) {
      setFeedback("Preencha sua opção antes de apostar.");
      return;
    }
    if (!/^\d+$/.test(normalizedAmount) || !Number.isInteger(parsed) || parsed <= 0) {
      setFeedback("Digite um número inteiro de pipetz.");
      return;
    }
    if (typeof viewerBalance === "number" && parsed > viewerBalance) {
      setFeedback(`Seu saldo atual é ${formatPipetz(viewerBalance)} pipetz. Aposte um valor menor.`);
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/me/bets/${bet.id}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            optionId: selectedOption ?? undefined,
            optionLabel: isFreeformBet && !hasViewerBet ? normalizedFreeformOption : undefined,
            amount: parsed,
            source: "web",
          }),
        });

        const payload = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          setFeedback(mapError(payload.error ?? "Falha ao registrar aposta."));
          return;
        }

        setAmount("");
        setFreeformOption("");
        setFeedback(hasViewerBet ? "Valor adicionado à sua aposta." : "Aposta registrada.");
        router.refresh();
      } catch {
        setFeedback("Não consegui registrar a aposta agora. Tente novamente.");
      }
    });
  }

  return (
    <article
      className="panel-inset flex h-full flex-col p-5"
      style={{
        backgroundColor: cardBackground,
      }}
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 border border-[var(--color-ink)] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em]",
                displayStatus.className,
              )}
            >
              <StatusIcon className="size-4" aria-hidden="true" />
              {displayStatus.label}
            </span>
            <span className="mono text-[11px] font-black uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
              fecha {formatBetDeadline(bet.closesAt)} BRT
            </span>
          </div>

          <h3
            className="mt-3 text-pretty break-words text-2xl uppercase leading-[1.05]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {bet.question}
          </h3>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 sm:min-w-44 sm:grid-cols-1">
          <div className="border border-[var(--color-ink)] bg-[var(--color-paper)] px-3 py-2">
            <p className="mono text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-ink-soft)]">
              pool
            </p>
            <p className="mt-1 text-lg font-black leading-none">{formatPipetz(totalPool)}</p>
          </div>
          {typeof viewerBalance === "number" ? (
            <div className="border border-[var(--color-ink)] bg-[var(--color-paper)] px-3 py-2">
              <p className="mono flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-ink-soft)]">
                <WalletCards className="size-3.5" aria-hidden="true" />
                saldo
              </p>
              <p className="mt-1 text-lg font-black leading-none">{formatPipetz(viewerBalance)}</p>
            </div>
          ) : null}
        </div>
      </header>

      {isOpen ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[var(--color-ink-soft)]">
          <Clock3 className="size-4 shrink-0" aria-hidden="true" />
          <span className="text-sm font-black uppercase tracking-[0.08em]">
            {formatRemaining(bet.closesAt, nowMs)}
          </span>
        </div>
      ) : bet.status === "locked" ? (
        <p className="mt-4 text-sm font-bold leading-6 text-[var(--color-ink-soft)]">
          A rodada está travada e aguardando resultado.
        </p>
      ) : null}

      {bet.options.length > 0 && totalPool > 0 ? (
        <div className="mt-5 h-3 overflow-hidden border border-[var(--color-ink)] bg-[var(--color-paper)]" aria-hidden="true">
          <div className="flex h-full">
            {bet.options.map((option, index) => {
              const percentage = Math.max((option.poolAmount / totalPool) * 100, 2);
              return (
                <div
                  key={option.id}
                  className="h-full transition-[width,background-color] duration-300"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: optionColors[index % optionColors.length],
                  }}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {bet.options.map((option, index) => {
          const isWinner = isResolved && bet.winningOptionId === option.id;
          const isViewerPick = bet.viewerPosition?.optionId === option.id;
          const isSelected = selectedOption === option.id || isViewerPick;
          const percentage = totalPool > 0 ? Math.round((option.poolAmount / totalPool) * 100) : 0;
          const baseClassName = cn(
            "relative flex min-h-16 items-center justify-between gap-4 border border-[var(--color-ink)] px-3 py-3 text-left text-[var(--color-ink)] transition-[background-color,box-shadow,filter,transform] duration-[var(--snap)]",
            isWinner
              ? "bg-[var(--color-mint)] text-[var(--color-accent-ink)]"
              : isSelected
                ? "bg-[var(--color-lavender)]"
                : optionBackgrounds[index % optionBackgrounds.length],
            canSelectOption &&
              "hover:shadow-[3px_3px_0_var(--shadow-color)] hover:brightness-95 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-purple-mid)]",
          );
          const rowContent = (
            <>
              <div className="flex min-w-0 items-center gap-3">
                <span className="mono shrink-0 border border-[var(--color-ink)] bg-[var(--color-paper)] px-2 py-1 text-[10px] font-black uppercase text-[var(--color-ink)]">
                  #{index + 1}
                </span>
                <span
                  className="size-4 shrink-0 border border-[var(--color-ink)]"
                  style={{
                    backgroundColor: optionColors[index % optionColors.length],
                  }}
                  aria-hidden="true"
                />
                <span className="min-w-0 break-words text-base font-black leading-5">
                  {isWinner ? "Venceu: " : ""}
                  {option.label}
                </span>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <span className="mono text-[10px] font-black uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
                  {percentage}%
                </span>
                <span className="text-sm font-black">{formatPipetz(option.poolAmount)}</span>
                {isViewerPick ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    sua aposta
                  </span>
                ) : null}
              </div>
            </>
          );

          return canSelectOption ? (
            <button
              key={option.id}
              type="button"
              onClick={() => setDraftSelectedOption(selectedOption === option.id ? null : option.id)}
              className={baseClassName}
              aria-pressed={selectedOption === option.id}
              aria-label={`Escolher opção ${index + 1}: ${option.label}`}
            >
              {rowContent}
            </button>
          ) : (
            <div key={option.id} className={baseClassName}>
              {rowContent}
            </div>
          );
        })}
      </div>

      {isOpen ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[var(--color-ink-soft)]">
          <span className="mono text-[10px] font-black uppercase tracking-[0.18em]">
            também no chat
          </span>
          <code
            className="border border-[var(--color-ink)] bg-[var(--color-paper)] px-2 py-1 text-xs font-black text-[var(--color-ink)]"
            translate="no"
          >
            {isFreeformBet ? "!bet palpite 100" : "!bet 1 100"}
          </code>
        </div>
      ) : null}

      {bet.viewerPosition ? (
        <div className="mt-5 border-t border-dashed border-[var(--color-ink)] pt-4 text-sm text-[var(--color-ink)]">
          <p className="font-black uppercase tracking-[0.08em]">Sua posição</p>
          <p className="mt-2 font-bold leading-6">
            {formatPipetz(bet.viewerPosition.amount)} pipetz em {viewerPositionLabel}
          </p>
          {canAddToExistingBet ? (
            <p className="mt-1 leading-6 text-[var(--color-ink-soft)]">
              Você pode adicionar mais pipetz nessa mesma opção até a janela fechar.
            </p>
          ) : null}
          {bet.viewerPosition.payoutAmount !== null ? (
            <p className="mt-1 leading-6 text-[var(--color-ink-soft)]">
              Retorno: {formatPipetz(bet.viewerPosition.payoutAmount)} pipetz
            </p>
          ) : null}
          {bet.viewerPosition.refundedAt ? (
            <p className="mt-1 leading-6 text-[var(--color-ink-soft)]">Aposta reembolsada.</p>
          ) : null}
        </div>
      ) : null}

      {showAmountForm ? (
        <form
          onSubmit={handlePlace}
          className="mt-5 border-t border-dashed border-[var(--color-ink)] pt-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {isFreeformBet && !hasViewerBet ? (
              <label htmlFor={freeformOptionId} className="flex min-w-0 flex-[2] flex-col gap-2">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                  Sua opção
                </span>
                <Input
                  id={freeformOptionId}
                  name={`bet-${bet.id}-option`}
                  type="text"
                  maxLength={255}
                  autoComplete="off"
                  placeholder="Ex.: 07:42"
                  value={freeformOption}
                  onChange={(event) => setFreeformOption(event.target.value)}
                  aria-describedby={feedback ? feedbackId : undefined}
                  className="px-3 py-2"
                />
              </label>
            ) : null}
            <label htmlFor={amountId} className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                {hasViewerBet ? `Adicionar em ${selectedOptionLabel}` : "Valor em pipetz"}
              </span>
              <Input
                id={amountId}
                name={`bet-${bet.id}-amount`}
                type="number"
                min="1"
                inputMode="numeric"
                autoComplete="off"
                placeholder="100…"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-describedby={feedback ? feedbackId : undefined}
                className="max-w-40 px-3 py-2"
              />
            </label>
            <Button type="submit" disabled={isPending} size="sm">
              <Send className="size-4" aria-hidden="true" />
              {isPending ? "Enviando…" : hasViewerBet ? "Adicionar" : "Apostar"}
            </Button>
          </div>
        </form>
      ) : null}

      {isOpen && !loggedIn ? (
        <p className="mt-4 border-t border-dashed border-[var(--color-ink)] pt-4 text-xs font-black uppercase leading-5 tracking-[0.14em] text-[var(--color-ink-soft)]">
          Entre com Google para apostar pelo site.
        </p>
      ) : null}
      {isOpen && loggedIn && !canBet && !bet.viewerPosition ? (
        <p className="mt-4 border-t border-dashed border-[var(--color-ink)] pt-4 text-xs font-black uppercase leading-5 tracking-[0.14em] text-[var(--color-ink-soft)]">
          Vincule sua conta ao chat para apostar.
        </p>
      ) : null}
      {feedback ? (
        <div
          id={feedbackId}
          role="status"
          aria-live="polite"
          className="mt-4 inline-flex w-fit border border-[var(--color-ink)] bg-[var(--color-purple)] px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[var(--color-accent-ink)]"
        >
          {feedback}
        </div>
      ) : null}
    </article>
  );
}
