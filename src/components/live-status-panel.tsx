"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isBridgeOnline } from "@/lib/redemptions/service";
import type { BridgeClientRecord, LivestreamStatusRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type LiveStatusAction = "force_online" | "force_offline" | "clear_override";

const actionConfig: Record<
  LiveStatusAction,
  {
    keyword: string;
    label: string;
    pendingLabel: string;
    successMessage: string;
    variant: "success" | "danger" | "neutral";
  }
> = {
  force_online: {
    keyword: "ONLINE",
    label: "Forçar online",
    pendingLabel: "Forçando online...",
    successMessage: "Live forçada para online.",
    variant: "success",
  },
  force_offline: {
    keyword: "OFFLINE",
    label: "Forçar offline",
    pendingLabel: "Forçando offline...",
    successMessage: "Live forçada para offline.",
    variant: "danger",
  },
  clear_override: {
    keyword: "AUTO",
    label: "Voltar ao automático",
    pendingLabel: "Limpando override...",
    successMessage: "Override manual removido.",
    variant: "neutral",
  },
};

export function LiveStatusPanel({
  bridge,
  initialStatus,
}: {
  bridge: BridgeClientRecord[];
  initialStatus: LivestreamStatusRecord;
}) {
  const router = useRouter();
  const current = bridge[0];
  const online = isBridgeOnline(current?.lastSeenAt);
  const [status, setStatus] = useState(initialStatus);
  const [armedAction, setArmedAction] = useState<LiveStatusAction | null>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function armAction(action: LiveStatusAction) {
    setArmedAction(action);
    setConfirmationText("");
    setFeedback(null);
  }

  function cancelAction() {
    setArmedAction(null);
    setConfirmationText("");
  }

  function submitAction() {
    if (!armedAction) {
      return;
    }

    const expectedKeyword = actionConfig[armedAction].keyword;
    if (confirmationText.trim().toUpperCase() !== expectedKeyword) {
      setFeedback(`Digite "${expectedKeyword}" para confirmar.`);
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/live-status", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: armedAction,
            confirmationText: confirmationText.trim(),
          }),
        });

        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          data?: LivestreamStatusRecord;
        };

        if (!response.ok || !payload.ok || !payload.data) {
          setFeedback(payload.error ?? "Falha ao atualizar o status da live.");
          return;
        }

        setStatus(payload.data);
        setFeedback(actionConfig[armedAction].successMessage);
        setArmedAction(null);
        setConfirmationText("");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao atualizar o status da live.");
      }
    });
  }

  return (
    <div className="panel surface-section relative overflow-hidden p-6">
      <div className="bg-dots-light pointer-events-none absolute inset-0 opacity-5" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              className="text-2xl font-bold uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {current?.label ?? "Aguardando conector"}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="sticker px-4 py-2 text-sm text-[var(--color-ink)]"
              style={{
                backgroundColor: online
                  ? "color-mix(in srgb, var(--color-mint) 22%, var(--surface-card) 78%)"
                  : "color-mix(in srgb, var(--color-rose) 24%, var(--surface-card) 76%)",
              }}
            >
              {online ? (
                <>
                  <span className="pulse-live mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-mint)]" />
                  Bridge online
                </>
              ) : (
                "Bridge offline"
              )}
            </div>
            <div
              className="sticker px-4 py-2 text-sm text-[var(--color-ink)]"
              style={{
                backgroundColor: status.isLive
                  ? "color-mix(in srgb, var(--color-mint) 30%, var(--color-paper) 70%)"
                  : "color-mix(in srgb, var(--color-rose) 28%, var(--color-paper) 72%)",
              }}
            >
              {status.isLive ? "Live online" : "Live offline"}
            </div>
            <div className="retro-label neutral-chip">
              {status.source === "manual" ? "Modo manual" : "Modo automático"}
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="card-brutal-static surface-card p-4">
            <p className="mono text-xs uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
              Último heartbeat
            </p>
            <p className="mt-2 text-lg font-bold">{formatDateTime(current?.lastSeenAt)}</p>
          </div>
          <div className="card-brutal-static surface-card-alt p-4">
            <p className="mono text-xs uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
              Machine key
            </p>
            <p className="mt-2 text-lg font-bold">{current?.machineKey ?? "sem bridge"}</p>
          </div>
        </div>

        <div className="mt-4 card-brutal-static surface-card-accent p-4">
          <p className="mono text-xs uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
            Controle manual da live
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--color-ink-soft)]">
            Esse override muda o estado efetivo usado pelos fluxos que dependem da live estar online,
            mesmo se a detecção automática estiver atrasada ou indisponível.
          </p>

          {status.manualOverride ? (
            <p className="mt-3 text-sm font-bold text-[var(--color-ink)]">
              Override ativo desde {formatDateTime(status.manualOverride.updatedAt)}
              {status.manualOverride.updatedBy ? ` por ${status.manualOverride.updatedBy}` : ""}.
            </p>
          ) : (
            <p className="mt-3 text-sm font-bold text-[var(--color-ink)]">
              Nenhum override manual ativo.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => armAction("force_online")}
              disabled={isPending}
              variant="success"
              size="sm"
            >
              Forçar online
            </Button>
            <Button
              type="button"
              onClick={() => armAction("force_offline")}
              disabled={isPending}
              variant="danger"
              size="sm"
            >
              Forçar offline
            </Button>
            <Button
              type="button"
              onClick={() => armAction("clear_override")}
              disabled={isPending || status.source !== "manual"}
              variant="neutral"
              size="sm"
            >
              Voltar ao automático
            </Button>
          </div>

          {armedAction ? (
            <div className="mt-4 rounded-[var(--radius)] border-2 border-dashed border-[var(--color-ink)] bg-[var(--color-paper)]/70 p-4">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-ink)]">
                Confirmar: {actionConfig[armedAction].label}
              </p>
              <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                Digite <span className="font-black text-[var(--color-ink)]">{actionConfig[armedAction].keyword}</span> para evitar acionamento acidental.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  placeholder={`Digite "${actionConfig[armedAction].keyword}"`}
                  className="w-full sm:w-56 px-3 py-2"
                />
                <Button
                  type="button"
                  onClick={submitAction}
                  disabled={isPending}
                  variant={actionConfig[armedAction].variant}
                  size="sm"
                >
                  {isPending ? actionConfig[armedAction].pendingLabel : actionConfig[armedAction].label}
                </Button>
                <Button
                  type="button"
                  onClick={cancelAction}
                  disabled={isPending}
                  variant="neutral"
                  size="sm"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}

          {feedback ? <div className="retro-label neutral-chip mt-4">{feedback}</div> : null}
        </div>
      </div>
    </div>
  );
}
