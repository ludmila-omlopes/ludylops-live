"use client";

import { CheckCircle2, Lock, Plus, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { validateCreateBetDraft } from "@/lib/bets/admin";
import { evaluateBetLifecycleAction } from "@/lib/bets/service";
import type { BetStatus, BetWithOptionsRecord } from "@/lib/types";
import { cn, formatDateTime, formatPipetz } from "@/lib/utils";

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function minLocalDateTimeInput() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function mapAdminBetError(message: string) {
  switch (message) {
    case "bet_not_open":
      return "Só é possível travar apostas abertas.";
    case "bet_not_locked":
      return "Só é possível resolver apostas travadas.";
    case "bet_already_locked":
      return "A aposta já está travada.";
    case "bet_already_resolved":
      return "A aposta já foi resolvida.";
    case "bet_already_cancelled":
      return "A aposta já foi cancelada.";
    default:
      return message;
  }
}

const statusLabels: Record<BetStatus, string> = {
  draft: "Rascunho",
  open: "Aberta",
  locked: "Travada",
  resolved: "Resolvida",
  cancelled: "Cancelada",
};

const statusTone: Record<BetStatus, string> = {
  draft: "bg-[var(--color-paper)]",
  open: "bg-[var(--color-mint)]",
  locked: "bg-[var(--color-sky)]",
  resolved: "bg-[var(--color-lavender)]",
  cancelled: "bg-[var(--color-rose)]",
};

const INITIAL_VISIBLE_BETS = 5;

function lifecycleRows(bet: BetWithOptionsRecord) {
  return [
    { label: "Criada", value: bet.createdAt },
    { label: "Aberta", value: bet.openedAt },
    { label: "Fecha", value: bet.closesAt },
    { label: "Travada", value: bet.lockedAt },
    { label: "Resolvida", value: bet.resolvedAt },
    { label: "Cancelada", value: bet.cancelledAt },
  ];
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="card-brutal-static bg-[var(--color-paper)] p-3">
      <p className="mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-[var(--color-ink)]">{value}</p>
    </div>
  );
}

export function AdminBetsPanel({
  bets,
  embedded = false,
}: {
  bets: BetWithOptionsRecord[];
  embedded?: boolean;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [optionsText, setOptionsText] = useState("Sim\nNão");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resolveSelections, setResolveSelections] = useState<Record<string, string>>({});
  const [showAllBets, setShowAllBets] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function runAction(url: string, body?: Record<string, unknown>) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const raw = await response.text();
    let payload: { ok?: boolean; error?: string } | null = null;

    if (raw) {
      try {
        payload = JSON.parse(raw) as { ok?: boolean; error?: string };
      } catch {
        payload = null;
      }
    }

    if (!response.ok || !payload?.ok) {
      if (payload?.error) {
        throw new Error(payload.error);
      }

      const trimmed = raw.trim();
      if (trimmed && !trimmed.startsWith("<")) {
        throw new Error(trimmed);
      }

      throw new Error("Falha na operação.");
    }
  }

  function handleCreate() {
    const options = optionsText
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    const closesAtDate = new Date(closesAt);
    const closesAtIso = Number.isFinite(closesAtDate.getTime()) ? closesAtDate.toISOString() : "";
    const validationError = validateCreateBetDraft({
      question: question.trim(),
      closesAt: closesAtIso,
      options,
    });

    if (validationError) {
      setFeedback(validationError);
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        await runAction("/api/admin/bets", {
          question: question.trim(),
          closesAt: closesAtIso,
          options,
          startOpen: true,
        });
        setQuestion("");
        setClosesAt("");
        setOptionsText("Sim\nNão");
        setFeedback("Aposta criada.");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao criar aposta.");
      }
    });
  }

  function submitAction(url: string, body?: Record<string, unknown>) {
    setFeedback(null);
    startTransition(async () => {
      try {
        await runAction(url, body);
        setFeedback("Operação concluída.");
        router.refresh();
      } catch (error) {
        setFeedback(
          error instanceof Error ? mapAdminBetError(error.message) : "Falha ao executar operação.",
        );
      }
    });
  }

  const openCount = bets.filter((bet) => bet.status === "open").length;
  const lockedCount = bets.filter((bet) => bet.status === "locked").length;
  const unresolvedPool = bets
    .filter((bet) => bet.status === "open" || bet.status === "locked")
    .reduce((sum, bet) => sum + bet.totalPool, 0);
  const visibleBets = showAllBets ? bets : bets.slice(0, INITIAL_VISIBLE_BETS);
  const hiddenBetCount = Math.max(bets.length - visibleBets.length, 0);

  const content = (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Abertas" value={String(openCount)} />
          <Metric label="Travadas" value={String(lockedCount)} />
          <Metric label="Em jogo" value={`${formatPipetz(unresolvedPool)} pipetz`} />
        </div>

        <div className="card-brutal-static p-5">
          <p className="mono text-xs uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
            Nova aposta
          </p>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
                Pergunta da aposta
              </span>
              <Input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ex.: Ela passa o boss sem morrer?"
                minLength={6}
                maxLength={255}
                className="px-3 py-2"
              />
              <span className="text-xs font-bold text-[var(--color-ink-soft)]">
                Entre 6 e 255 caracteres.
              </span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
                Encerrar apostas em
              </span>
              <Input
                type="datetime-local"
                value={closesAt}
                onChange={(event) => setClosesAt(event.target.value)}
                min={minLocalDateTimeInput()}
                className="px-3 py-2"
              />
              <span className="text-xs font-bold text-[var(--color-ink-soft)]">
                Data e hora locais em que a janela fecha. Depois desse horário, ninguém mais consegue apostar.
              </span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
                Opções
              </span>
              <Textarea
                value={optionsText}
                onChange={(event) => setOptionsText(event.target.value)}
                rows={5}
                maxLength={1550}
                placeholder={"Sim\nNão"}
                className="min-h-32 px-3 py-2 font-bold"
              />
              <span className="text-xs font-bold text-[var(--color-ink-soft)]">
                Use uma opção por linha. Mínimo de 2 e máximo de 6 opções.
              </span>
            </label>

            <Button
              type="button"
              onClick={handleCreate}
              disabled={isPending}
              size="sm"
              className="w-full gap-2 sm:w-fit"
            >
              <Plus className="size-4" />
              {isPending ? "Enviando..." : "Criar aposta"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {bets.length === 0 ? (
          <div className="card-brutal-static p-4 text-sm font-bold text-[var(--color-ink-soft)]">
            Nenhuma aposta cadastrada.
          </div>
        ) : null}

        {visibleBets.map((bet) => {
          const canLock = evaluateBetLifecycleAction({ action: "lock", status: bet.status }).canTransition;
          const canResolve = evaluateBetLifecycleAction({
            action: "resolve",
            status: bet.status,
          }).canTransition;
          const canCancel = evaluateBetLifecycleAction({ action: "cancel", status: bet.status }).canTransition;
          const winningOption = bet.options.find((option) => option.id === bet.winningOptionId);
          const summary = bet.adminSummary;

          return (
            <article key={bet.id} className="card-brutal-static bg-[var(--color-paper)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "badge-brutal px-2 py-1 text-[10px] text-[var(--color-ink)]",
                        statusTone[bet.status],
                      )}
                    >
                      {statusLabels[bet.status]}
                    </span>
                    <span className="mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                      fecha {toLocalDateTimeInput(bet.closesAt).replace("T", " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-black leading-snug">{bet.question}</p>
                </div>
                <span className="retro-label neutral-chip">
                  {formatPipetz(bet.totalPool)} pipetz
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Metric label="Participantes" value={String(summary?.participantCount ?? 0)} />
                <Metric label="Entradas" value={String(summary?.entryCount ?? 0)} />
                <Metric
                  label={bet.status === "cancelled" ? "Reembolsado" : "Pago"}
                  value={`${formatPipetz(bet.status === "cancelled" ? (summary?.totalRefunded ?? 0) : (summary?.totalPayout ?? 0))} pipetz`}
                />
              </div>

              <div className="mt-4 grid gap-2">
                {bet.options.map((option) => {
                  const isWinning = option.id === bet.winningOptionId;
                  return (
                    <div
                      key={option.id}
                      className={cn(
                        "grid gap-2 border-t-2 border-[var(--color-ink)] pt-3 text-sm font-bold sm:grid-cols-[1fr_auto]",
                        isWinning ? "text-[var(--color-accent-ink)]" : "text-[var(--color-ink)]",
                      )}
                    >
                      <span>
                        {option.label}
                        {isWinning ? " · vencedora" : ""}
                      </span>
                      <span className="mono text-xs text-[var(--color-ink-soft)]">
                        {formatPipetz(option.poolAmount)} pipetz
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
                <div className="card-brutal-static bg-[var(--color-paper-pink)] p-3">
                  <p className="mono text-[10px] uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
                    Linha do tempo
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {lifecycleRows(bet).map((row) => (
                      <div key={row.label} className="text-xs">
                        <span className="font-black uppercase text-[var(--color-ink)]">{row.label}: </span>
                        <span className="font-bold text-[var(--color-ink-soft)]">
                          {row.value ? formatDateTime(row.value) : "pendente"}
                        </span>
                      </div>
                    ))}
                    <div className="text-xs sm:col-span-2">
                      <span className="font-black uppercase text-[var(--color-ink)]">Última entrada: </span>
                      <span className="font-bold text-[var(--color-ink-soft)]">
                        {summary?.lastEntryAt ? formatDateTime(summary.lastEntryAt) : "sem entradas"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card-brutal-static bg-[var(--color-sky)] p-3">
                  <p className="mono text-[10px] uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
                    Resultado financeiro
                  </p>
                  <div className="mt-3 grid gap-2 text-xs font-bold text-[var(--color-ink-soft)]">
                    <p>
                      Vencedora:{" "}
                      <span className="text-[var(--color-ink)]">
                        {winningOption?.label ?? "ainda não definida"}
                      </span>
                    </p>
                    <p>Pool vencedor: {formatPipetz(summary?.winningPool ?? 0)} pipetz</p>
                    <p>Pool perdedor: {formatPipetz(summary?.losingPool ?? 0)} pipetz</p>
                    <p>Entradas liquidadas: {summary?.settledCount ?? 0}</p>
                    <p>Entradas reembolsadas: {summary?.refundedCount ?? 0}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {canLock ? (
                  <Button
                    type="button"
                    onClick={() => submitAction(`/api/admin/bets/${bet.id}/lock`)}
                    disabled={isPending}
                    variant="neutral"
                    size="sm"
                    className="gap-2"
                  >
                    <Lock className="size-4" />
                    Travar
                  </Button>
                ) : null}
                {canResolve ? (
                  <>
                    <Select
                      value={resolveSelections[bet.id] || null}
                      onValueChange={(value) =>
                        setResolveSelections((current) => ({
                          ...current,
                          [bet.id]: value ?? "",
                        }))
                      }
                    >
                      <SelectTrigger size="sm" className="min-w-[220px]">
                        <SelectValue placeholder="Escolha vencedora">
                          {(value) =>
                            bet.options.find((option) => option.id === value)?.label ??
                            "Escolha vencedora"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {bet.options.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      onClick={() =>
                        submitAction(`/api/admin/bets/${bet.id}/resolve`, {
                          winningOptionId: resolveSelections[bet.id],
                        })
                      }
                      disabled={isPending || !resolveSelections[bet.id]}
                      size="sm"
                      className="gap-2"
                    >
                      <CheckCircle2 className="size-4" />
                      Resolver
                    </Button>
                  </>
                ) : null}
                {canCancel ? (
                  <Button
                    type="button"
                    onClick={() => submitAction(`/api/admin/bets/${bet.id}/cancel`)}
                    disabled={isPending}
                    variant="danger"
                    size="sm"
                    className="gap-2"
                  >
                    <XCircle className="size-4" />
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
        {hiddenBetCount > 0 || showAllBets ? (
          <div className="card-brutal-static flex justify-center p-4">
            <Button
              type="button"
              onClick={() => setShowAllBets((current) => !current)}
              variant="neutral"
              size="sm"
            >
              {showAllBets ? "Ver menos" : `Ver mais ${hiddenBetCount}`}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              className="text-3xl uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Auditoria da live
            </h2>
          </div>
          {feedback ? <div className="retro-label neutral-chip">{feedback}</div> : null}
        </div>
        {content}
      </div>
    );
  }

  return (
    <section className="landing-plane landing-divider bg-[var(--color-mint)] py-8 text-[var(--color-accent-ink)] sm:py-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              className="text-3xl uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Auditoria da live
            </h2>
          </div>
          {feedback ? <div className="retro-label neutral-chip">{feedback}</div> : null}
        </div>
        <div className="mt-6">{content}</div>
      </div>
    </section>
  );
}
