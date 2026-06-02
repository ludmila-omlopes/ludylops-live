"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { LiveLikeGoalOverlayStateRecord } from "@/lib/types";
import { formatPipetz } from "@/lib/utils";

const DEMO_UPDATED_AT = "2026-06-01T21:00:00.000Z";

const DEMO_STATE: LiveLikeGoalOverlayStateRecord = {
  currentLikeCount: 42,
  updatedAt: DEMO_UPDATED_AT,
  broadcastId: "demo-live",
  goal: {
    id: "demo-like-goal",
    label: "Meta 50 likes",
    targetLikeCount: 50,
    rewardAmount: 150,
    isActive: true,
    createdAt: DEMO_UPDATED_AT,
    updatedAt: DEMO_UPDATED_AT,
  },
  progressPercent: 84,
  remainingLikes: 8,
  isGoalReached: false,
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function ObsLikeGoalOverlay() {
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "1";
  const [liveState, setLiveState] = useState<LiveLikeGoalOverlayStateRecord | null>(null);

  useEffect(() => {
    if (isDemo) {
      return undefined;
    }

    let cancelled = false;

    async function loadState() {
      try {
        const response = await fetch("/api/obs/likes/current", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data: LiveLikeGoalOverlayStateRecord;
        };

        if (!cancelled) {
          setLiveState(payload.data);
        }
      } catch {
        if (!cancelled) {
          setLiveState(null);
        }
      }
    }

    void loadState();
    const interval = window.setInterval(() => {
      void loadState();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isDemo]);

  const state = isDemo ? DEMO_STATE : liveState;
  const goal = state?.goal ?? null;
  const currentLikeCount = state?.currentLikeCount ?? 0;
  const progressPercent = state?.progressPercent ?? 0;

  return (
    <div className="pointer-events-none flex min-h-screen items-end justify-center p-6 sm:justify-end sm:p-10 lg:p-14">
      <section
        className="min-w-0 overflow-hidden border-[4px] border-black bg-[#fff6db] text-black shadow-[12px_12px_0_#000]"
        style={{ width: "min(1040px, 92vw)" }}
        aria-live="polite"
      >
        <div className="p-4 sm:p-5">
          {!state ? (
            <div className="border-[3px] border-black bg-white p-5 text-2xl font-black uppercase">
              Carregando meta de likes.
            </div>
          ) : goal ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(180px,0.55fr)_minmax(360px,1fr)_auto] lg:items-center">
              <p className="min-w-0 break-words text-2xl font-black uppercase sm:text-3xl">
                {goal.label || `${formatNumber(goal.targetLikeCount)} likes`}
              </p>

              <div className="border-[4px] border-black bg-white">
                <div className="relative h-12 overflow-hidden">
                  <div
                    className="h-full bg-[#ff66b3] transition-[width] duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-start px-4 text-lg font-black uppercase sm:justify-end">
                    {formatNumber(currentLikeCount)}/{formatNumber(goal.targetLikeCount)}
                  </div>
                </div>
              </div>

              <span className="block w-full max-w-full break-words border-[3px] border-black bg-[#41d1ff] px-3 py-1 text-xs font-black uppercase sm:w-auto sm:text-base">
                {formatPipetz(goal.rewardAmount)} pipetz pra cada presente
              </span>
            </div>
          ) : (
            <div className="border-[3px] border-black bg-white p-5 text-2xl font-black uppercase">
              Configure uma meta ativa no admin.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
