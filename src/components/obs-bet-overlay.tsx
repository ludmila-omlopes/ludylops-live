"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getObsOverlayStyle, type ObsOverlayStyle } from "@/lib/obs-overlay-style";
import type { BetWithOptionsRecord } from "@/lib/types";
import { formatPipetz } from "@/lib/utils";

const DEMO_BET: BetWithOptionsRecord = {
  id: "demo-bet",
  question: "Ela passa o boss sem morrer?",
  optionMode: "preset",
  status: "open",
  openedAt: "2026-05-20T18:00:00.000Z",
  closesAt: "2026-05-20T19:00:00.000Z",
  lockedAt: null,
  resolvedAt: null,
  cancelledAt: null,
  winningOptionId: null,
  createdAt: "2026-05-20T18:00:00.000Z",
  totalPool: 1250,
  options: [
    { id: "yes", betId: "demo-bet", label: "Sim", sortOrder: 0, poolAmount: 800 },
    { id: "no", betId: "demo-bet", label: "Não", sortOrder: 1, poolAmount: 450 },
  ],
  viewerPosition: null,
};

function formatRemaining(closesAt: string, now: number) {
  const remainingMs = Math.max(new Date(closesAt).getTime() - now, 0);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ObsBetOverlay({ initialStyle = "classic" }: { initialStyle?: ObsOverlayStyle }) {
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "1";
  const isObscurStyle = (getObsOverlayStyle(searchParams) ?? initialStyle) === "obscur";
  const [liveBet, setLiveBet] = useState<BetWithOptionsRecord | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (isDemo) {
      return undefined;
    }

    let cancelled = false;

    async function loadBet() {
      try {
        const response = await fetch("/api/obs/bets/current", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data: BetWithOptionsRecord | null;
        };

        if (!cancelled) {
          setLiveBet(payload.data ?? null);
        }
      } catch {
        if (!cancelled) {
          setLiveBet(null);
        }
      }
    }

    void loadBet();
    const interval = window.setInterval(() => {
      void loadBet();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isDemo]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const bet = isDemo ? DEMO_BET : liveBet;
  const totalPool = bet?.totalPool ?? 0;
  const remaining = bet ? formatRemaining(bet.closesAt, now) : "00:00";

  if (isObscurStyle) {
    return (
      <div className="pointer-events-none flex min-h-screen items-end justify-start p-5 text-[#f8ecd4] sm:p-8 lg:p-10">
        {bet ? (
          <section
            key={bet.id}
            className="relative w-[min(680px,92vw)] overflow-hidden border-l border-[#d8b46a]/80 bg-[linear-gradient(90deg,rgba(7,7,10,0.74),rgba(7,7,10,0.40)_72%,rgba(7,7,10,0.02))] px-5 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-[2px]"
            aria-live="polite"
          >
            <div className="absolute inset-y-3 left-2 w-px bg-[#f3d58b]/60" />
            <div className="relative flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-[#d8b46a] [text-shadow:0_2px_14px_rgba(0,0,0,0.9)]">
              <span>fecha em {remaining}</span>
              <span>{formatPipetz(totalPool)} pipetz</span>
            </div>

            <h1
              className="relative mt-2 max-w-[24ch] break-words text-[1.45rem] font-semibold leading-tight [text-shadow:0_2px_18px_rgba(0,0,0,0.88)] sm:text-[2rem] lg:text-[2.35rem]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {bet.question}
            </h1>

            <div className="relative mt-4 grid gap-3">
              {bet.options.map((option, index) => {
                const percentage = totalPool > 0 ? Math.round((option.poolAmount / totalPool) * 100) : 0;
                return (
                  <div key={option.id}>
                    <div className="flex items-center justify-between gap-3 text-sm font-semibold [text-shadow:0_2px_14px_rgba(0,0,0,0.9)] sm:text-base">
                      <span className="min-w-0 break-words">
                        {index + 1}. {option.label}
                      </span>
                      <span className="shrink-0 text-[#d8b46a]">
                        {percentage}% - {formatPipetz(option.poolAmount)}
                      </span>
                    </div>
                    <div className="mt-1 h-[3px] overflow-hidden bg-[#f8ecd4]/18">
                      <div
                        className="h-full bg-[#d8b46a] transition-[width] duration-500"
                        style={{ width: `${Math.max(percentage, totalPool > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pointer-events-none flex min-h-screen items-end justify-center p-6 sm:p-10 lg:p-14">
      {bet ? (
        <section
          key={bet.id}
          className="relative w-full max-w-[980px] overflow-hidden border-[4px] border-black bg-[#fff6db] text-black shadow-[12px_12px_0_#000]"
          aria-live="polite"
        >
          <div className="absolute inset-0 opacity-25">
            <div className="h-full w-full bg-[radial-gradient(circle_at_18%_22%,#ff66b3_0,transparent_24%),radial-gradient(circle_at_78%_28%,#41d1ff_0,transparent_20%),radial-gradient(circle_at_55%_82%,#00beae_0,transparent_22%)]" />
          </div>
          <div className="absolute inset-x-0 top-0 h-5 border-b-[4px] border-black bg-[repeating-linear-gradient(90deg,#000_0_28px,#ff66b3_28px_56px,#41d1ff_56px_84px,#00beae_84px_112px)]" />
          <div className="relative flex flex-col gap-6 px-6 pb-6 pt-10 sm:px-10 sm:pb-10 sm:pt-12">
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.22em] sm:text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="border-[3px] border-black bg-black px-3 py-1 text-white">
                  Aposta aberta
                </span>
                <span className="border-[3px] border-black bg-[#00beae] px-3 py-1">
                  pool {formatPipetz(totalPool)} pipetz
                </span>
              </div>
              <span className="border-[3px] border-black bg-[#ff66b3] px-3 py-1">
                fecha em {remaining}
              </span>
            </div>

            <h1
              className="max-w-[22ch] text-[2rem] font-black uppercase leading-[0.94] sm:text-[3rem] lg:text-[4rem]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {bet.question}
            </h1>

            <div className="grid gap-3">
              {bet.options.map((option, index) => {
                const percentage = totalPool > 0 ? Math.round((option.poolAmount / totalPool) * 100) : 0;
                return (
                  <div key={option.id} className="border-[3px] border-black bg-white">
                    <div className="relative min-h-16 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-[#41d1ff]"
                        style={{ width: `${Math.max(percentage, totalPool > 0 ? 4 : 0)}%` }}
                      />
                      <div className="relative flex items-center justify-between gap-4 px-4 py-3 text-lg font-black uppercase sm:text-2xl">
                        <span>
                          {index + 1}. {option.label}
                        </span>
                        <span className="shrink-0 text-right">
                          {percentage}% · {formatPipetz(option.poolAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
