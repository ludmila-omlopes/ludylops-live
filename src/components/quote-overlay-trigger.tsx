"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { formatPipetz } from "@/lib/utils";

function mapError(message: string) {
  switch (message) {
    case "Unauthorized":
      return "Entre com sua conta para usar seus pipetz.";
    case "saldo_insuficiente":
      return "Saldo insuficiente.";
    case "livestream_not_live":
      return "Esse overlay só pode ser usado durante a live.";
    case "quote_overlay_busy":
      return "Já tem uma quote ocupando o overlay.";
    case "quote_not_found":
      return "Quote não encontrada.";
    case "quote_id_required":
      return "Escolha uma quote válida.";
    default:
      return "Não consegui mostrar a quote no OBS agora.";
  }
}

export function QuoteOverlayTrigger({
  quoteId,
  loggedIn,
  canShow,
  viewerBalance,
  quoteOverlayCost,
}: {
  quoteId: number;
  loggedIn: boolean;
  canShow: boolean;
  viewerBalance?: number | null;
  quoteOverlayCost: number;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasBalance = typeof viewerBalance === "number" && viewerBalance >= quoteOverlayCost;

  function handleShow() {
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch(`/api/me/quotes/${quoteId}/show`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          source: "web",
        }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          queued?: unknown;
        };
      };

      if (!response.ok || !payload.ok) {
        setFeedback(mapError(payload.error ?? ""));
        return;
      }

      setFeedback(payload.data?.queued ? "Quote entrou na fila do OBS." : "Quote enviada para o overlay.");
      router.refresh();
    });
  }

  if (!loggedIn) {
    return (
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-ink-soft)]">
        faça login para chamar no OBS
      </p>
    );
  }

  if (!canShow) {
    return (
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-ink-soft)]">
        selecione um canal para usar seus pipetz
      </p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        onClick={handleShow}
        disabled={isPending || !hasBalance}
        variant="info"
        size="sm"
      >
        {isPending ? "Enviando..." : `Mostrar no OBS (-${formatPipetz(quoteOverlayCost)})`}
      </Button>
      {!hasBalance ? (
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-ink-soft)]">
          faltam {formatPipetz(Math.max(quoteOverlayCost - (viewerBalance ?? 0), 0))} pipetz
        </p>
      ) : null}
      {feedback ? (
        <div className="sticker sticker-pop accent-chip inline-flex px-3 py-1.5 text-xs">
          {feedback}
        </div>
      ) : null}
    </div>
  );
}
