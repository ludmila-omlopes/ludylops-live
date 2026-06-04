"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ObsOverlayAdminStatusRecord } from "@/lib/types";
import { formatDateTime, formatPipetz } from "@/lib/utils";

const overlays = [
  {
    id: "quotes",
    name: "Quotes no OBS",
    description: "Overlay das quotes pagas em pipetz, com som embutido e visual pronto para browser source.",
    liveHref: "/obs/quotes",
    demoHref: "/obs/quotes?demo=1",
    apiHref: "/api/obs/quotes/current",
  },
  {
    id: "likes",
    name: "Meta de likes no OBS",
    description: "Overlay da meta ativa de likes, com contador, progresso e recompensa exibidos ao vivo.",
    liveHref: "/obs/likes",
    demoHref: "/obs/likes?demo=1",
    apiHref: "/api/obs/likes/current",
  },
  {
    id: "subscribers",
    name: "Novos inscritos no OBS",
    description: "Overlay de nova inscrição, com imagem configurável, som de alerta e fila local para eventos consecutivos.",
    liveHref: "/obs/subscribers",
    demoHref: "/obs/subscribers?demo=1",
    apiHref: "/api/obs/subscribers/current",
  },
  {
    id: "bets",
    name: "Apostas no OBS",
    description: "Overlay da aposta aberta, com pool, opções e distribuição dos votos atualizados automaticamente.",
    liveHref: "/obs/bets",
    demoHref: "/obs/bets?demo=1",
    apiHref: "/api/obs/bets/current",
  },
  {
    id: "wheel",
    name: "Roleta no OBS",
    description: "Overlay da roleta da live, com animação visual e resultado final mantido na tela.",
    liveHref: "/obs/wheel",
    demoHref: "/obs/wheel?demo=1",
    apiHref: "/api/obs/wheel/current",
  },
];

export function AdminObsOverlaysPanel({
  initialStatus,
}: {
  initialStatus: ObsOverlayAdminStatusRecord;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isPaused = status.control.status === "paused";
  const hasConfigurationError = status.control.status === "error";

  function submitAction(action: "pause" | "resume" | "cancel_queue") {
    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/obs-overlays", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ action }),
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          data?: ObsOverlayAdminStatusRecord;
        };

        if (!response.ok || !payload.ok || !payload.data) {
          setFeedback(payload.error ?? "Falha ao atualizar chamadas do OBS.");
          return;
        }

        setStatus(payload.data);
        setFeedback(
          action === "pause"
            ? "Chamadas ao OBS pausadas."
            : action === "resume"
              ? "Chamadas ao OBS retomadas."
              : "Fila pendente cancelada.",
        );
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao atualizar chamadas do OBS.");
      }
    });
  }

  return (
    <section className="landing-plane landing-divider bg-[var(--color-paper)] py-8 sm:py-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
        <div className="panel surface-section p-6">
          <p className="mono text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
            Overlays do OBS
          </p>
          <h2
            className="mt-3 text-3xl uppercase sm:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Seus browser sources
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-ink-soft)] sm:text-base">
            Aqui ficam os overlays hospedados pelo app. Use o link real no OBS e o link de demo
            quando quiser conferir o visual fora da live.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="card-brutal-static surface-card-accent p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="mono text-[10px] uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
                    chamadas ao OBS
                  </p>
                  <p className="mt-2 text-2xl font-black uppercase">
                    {hasConfigurationError
                      ? "Configurar banco"
                      : isPaused
                        ? "Pausadas"
                        : status.pendingCount > 0
                          ? "Processando fila"
                          : "Ativas"}
                  </p>
                </div>
                <span className="sticker px-3 py-1.5 text-xs">
                  {status.pendingCount} pendente{status.pendingCount === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">
                Quando pausado, novas quotes pagas entram em fila FIFO. A fila aceita até 20 itens e
                cada item expira em 2 horas com reembolso automático se não for exibido.
              </p>
              {status.control.lastError ? (
                <p className="mt-3 border-2 border-[var(--color-ink)] bg-[var(--color-rose)] px-3 py-2 text-sm font-black text-[var(--color-ink)]">
                  {status.control.lastError}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => submitAction("pause")}
                  disabled={isPending || isPaused || hasConfigurationError}
                  variant="danger"
                  size="sm"
                >
                  Pausar chamadas
                </Button>
                <Button
                  type="button"
                  onClick={() => submitAction("resume")}
                  disabled={isPending || !isPaused || hasConfigurationError}
                  variant="success"
                  size="sm"
                >
                  Retomar fila
                </Button>
                <Button
                  type="button"
                  onClick={() => submitAction("cancel_queue")}
                  disabled={isPending || status.pendingCount === 0 || hasConfigurationError}
                  variant="neutral"
                  size="sm"
                >
                  Cancelar fila
                </Button>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-[var(--color-ink-soft)]">
                <p>Atualizado em {formatDateTime(status.control.updatedAt)}</p>
                {status.control.updatedBy ? <p>Por {status.control.updatedBy}</p> : null}
                {feedback ? <p className="font-bold text-[var(--color-ink)]">{feedback}</p> : null}
              </div>
            </div>

            <div className="card-brutal-static surface-card p-4">
              <p className="mono text-[10px] uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
                fila pendente
              </p>
              <div className="mt-3 grid gap-3">
                {status.pending.length > 0 ? (
                  status.pending.slice(0, 5).map((entry, index) => (
                    <div
                      key={entry.id}
                      className="grid gap-2 border-t-2 border-[var(--color-ink)] pt-3 sm:grid-cols-[auto_1fr_auto]"
                    >
                      <span className="mono text-xs font-black">#{index + 1}</span>
                      <div>
                        <p className="font-black">Quote #{entry.quoteNumber}</p>
                        <p className="text-sm text-[var(--color-ink-soft)]">
                          {entry.requestedByDisplayName} - {formatDateTime(entry.queuedAt)}
                        </p>
                      </div>
                      <span className="mono text-xs font-black">{formatPipetz(entry.cost)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-bold text-[var(--color-ink-soft)]">
                    Nenhuma chamada aguardando.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {overlays.map((overlay, index) => (
              <Card
                key={overlay.id}
                variant="poster"
                className={`gap-4 p-5 text-[var(--color-accent-ink)] ${index % 2 === 0 ? "bg-[var(--color-blue)]" : "bg-[var(--color-mint)]"}`}
              >
                <CardHeader className="gap-2">
                  <CardDescription className="mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-accent-ink-soft)]">
                    browser source
                  </CardDescription>
                  <CardTitle
                    className="text-3xl uppercase leading-none"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {overlay.name}
                  </CardTitle>
                </CardHeader>

                <CardContent className="grid gap-4">
                  <p className="text-sm leading-7 text-[var(--color-accent-ink-soft)] sm:text-base">
                    {overlay.description}
                  </p>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="card-brutal-static bg-[var(--color-paper)] p-4">
                      <p className="mono text-[10px] uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
                        URL do OBS
                      </p>
                      <p className="mt-2 break-all text-sm font-black text-[var(--color-ink)]">
                        {overlay.liveHref}
                      </p>
                    </div>
                    <div className="card-brutal-static bg-[var(--color-paper)] p-4">
                      <p className="mono text-[10px] uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
                        Demo visual
                      </p>
                      <p className="mt-2 break-all text-sm font-black text-[var(--color-ink)]">
                        {overlay.demoHref}
                      </p>
                    </div>
                    <div className="card-brutal-static bg-[var(--color-paper)] p-4">
                      <p className="mono text-[10px] uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
                        Feed JSON
                      </p>
                      <p className="mt-2 break-all text-sm font-black text-[var(--color-ink)]">
                        {overlay.apiHref}
                      </p>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-wrap items-center gap-3">
                  <Link href={overlay.liveHref} className="btn-brutal ink-button px-4 py-2 text-xs">
                    Abrir overlay
                  </Link>
                  <Link href={overlay.demoHref} className="btn-brutal accent-button px-4 py-2 text-xs">
                    Abrir demo
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
