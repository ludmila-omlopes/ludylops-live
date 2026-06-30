"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getObsOverlayStyle, type ObsOverlayStyle } from "@/lib/obs-overlay-style";
import type { WheelConfigRecord, WheelSpinRecord } from "@/lib/types";

const DEMO_CONFIG: WheelConfigRecord = {
  title: "Roleta da live",
  spinDurationMs: 5200,
  resultHoldSeconds: 30,
  updatedAt: null,
  updatedBy: null,
  lastSpin: {
    spinId: "demo-spin",
    optionId: "demo-2",
    label: "Desafio do chat",
    color: "#00beae",
    requestedBy: "chat",
    source: "demo",
    startedAt: new Date().toISOString(),
    spinDurationMs: 5200,
    resultVisibleUntil: new Date(Date.now() + 60_000).toISOString(),
  },
  options: [
    { id: "demo-1", label: "Bônus de pipetz", weight: 1, color: "#ff66b3", isActive: true, sortOrder: 0 },
    { id: "demo-2", label: "Desafio do chat", weight: 1, color: "#00beae", isActive: true, sortOrder: 1 },
    { id: "demo-3", label: "Escolhe um jogo", weight: 1, color: "#41d1ff", isActive: true, sortOrder: 2 },
    { id: "demo-4", label: "Tenta de novo", weight: 1, color: "#ffe066", isActive: true, sortOrder: 3 },
  ],
};

function buildGradient(options: WheelConfigRecord["options"]) {
  const active = options.filter((option) => option.isActive);
  const total = active.reduce((sum, option) => sum + option.weight, 0);
  let cursor = 0;
  return active
    .map((option) => {
      const start = cursor;
      cursor += (option.weight / total) * 360;
      return `${option.color} ${start}deg ${cursor}deg`;
    })
    .join(", ");
}

function getOptionCenter(options: WheelConfigRecord["options"], optionId: string) {
  const active = options.filter((option) => option.isActive);
  const total = active.reduce((sum, option) => sum + option.weight, 0);
  let cursor = 0;
  for (const option of active) {
    const size = (option.weight / total) * 360;
    if (option.id === optionId) {
      return cursor + size / 2;
    }
    cursor += size;
  }
  return 0;
}

function isSpinVisible(spin: WheelSpinRecord | null) {
  return spin ? new Date(spin.resultVisibleUntil).getTime() > Date.now() : false;
}

export function ObsWheelOverlay({ initialStyle = "classic" }: { initialStyle?: ObsOverlayStyle }) {
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "1";
  const isObscurStyle = (getObsOverlayStyle(searchParams) ?? initialStyle) === "obscur";
  const [config, setConfig] = useState<WheelConfigRecord | null>(isDemo ? DEMO_CONFIG : null);
  const [rotation, setRotation] = useState(0);
  const [lastSpinId, setLastSpinId] = useState<string | null>(null);
  const spin = config?.lastSpin ?? null;
  const visibleSpin = isSpinVisible(spin) ? spin : null;
  const activeOptions = useMemo(() => config?.options.filter((option) => option.isActive) ?? [], [config]);
  const gradient = useMemo(() => buildGradient(activeOptions), [activeOptions]);

  useEffect(() => {
    if (isDemo) {
      return undefined;
    }

    let cancelled = false;

    async function loadWheel() {
      try {
        const response = await fetch("/api/obs/wheel/current", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { ok: boolean; data: WheelConfigRecord };
        if (!cancelled) {
          setConfig(payload.data);
        }
      } catch {
        if (!cancelled) {
          setConfig(null);
        }
      }
    }

    void loadWheel();
    const interval = window.setInterval(() => {
      void loadWheel();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isDemo]);

  useEffect(() => {
    if (!spin || !config || spin.spinId === lastSpinId) {
      return;
    }

    const center = getOptionCenter(config.options, spin.optionId);
    const timeout = window.setTimeout(() => {
      setRotation((current) => Math.ceil(current / 360) * 360 + 2160 - center);
      setLastSpinId(spin.spinId);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [config, lastSpinId, spin]);

  if (!config || activeOptions.length < 2) {
    return null;
  }

  if (isObscurStyle) {
    return (
      <div className="pointer-events-none flex min-h-screen items-end justify-end p-5 text-[#f8ecd4] sm:p-8 lg:p-10">
        <section
          className="grid w-[min(700px,92vw)] items-end gap-5 sm:grid-cols-[230px_1fr]"
          aria-live="polite"
        >
          <div className="relative mx-auto aspect-square w-[min(230px,48vw)] sm:w-full">
            <div className="absolute left-1/2 top-[-10px] z-20 h-0 w-0 -translate-x-1/2 border-x-[13px] border-t-[26px] border-x-transparent border-t-[#d8b46a] drop-shadow-[0_5px_10px_rgba(0,0,0,0.65)]" />
            <div
              className="absolute inset-0 rounded-full border border-[#d8b46a]/85 shadow-[0_18px_45px_rgba(0,0,0,0.48)]"
              style={{
                background: `conic-gradient(${gradient})`,
                filter: "saturate(0.72) brightness(0.82)",
                transform: `rotate(${rotation}deg)`,
                transition: `transform ${spin?.spinDurationMs ?? config.spinDurationMs}ms cubic-bezier(.12,.82,.16,1)`,
              }}
            >
              <div className="absolute inset-[15%] rounded-full border border-[#d8b46a]/60 bg-[rgba(8,7,10,0.72)]" />
              <div className="absolute inset-[41%] rounded-full bg-[#d8b46a]" />
            </div>
          </div>

          <div className="relative overflow-hidden border-l border-[#d8b46a]/80 bg-[linear-gradient(90deg,rgba(7,7,10,0.74),rgba(7,7,10,0.40)_72%,rgba(7,7,10,0.02))] px-5 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-[2px]">
            <div className="absolute inset-y-3 left-2 w-px bg-[#f3d58b]/60" />
            <h1
              className="relative max-w-[14ch] break-words text-[1.7rem] font-semibold leading-tight [text-shadow:0_2px_18px_rgba(0,0,0,0.88)] sm:text-[2.35rem] lg:text-[2.75rem]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {visibleSpin ? visibleSpin.label : "Pronta para girar"}
            </h1>
            <p className="relative mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-[#d8b46a] [text-shadow:0_2px_14px_rgba(0,0,0,0.9)]">
              <span>{visibleSpin ? "Resultado final" : `${activeOptions.length} opções ativas`}</span>
              <span>{config.title}</span>
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="pointer-events-none flex min-h-screen items-center justify-center p-6 text-black">
      <section className="grid w-full max-w-[1120px] items-center gap-8 lg:grid-cols-[620px_1fr]" aria-live="polite">
        <div className="relative aspect-square w-full">
          <div className="absolute left-1/2 top-[-18px] z-20 h-0 w-0 -translate-x-1/2 border-x-[28px] border-t-[56px] border-x-transparent border-t-black" />
          <div
            className="absolute inset-0 rounded-full border-[8px] border-black shadow-[16px_16px_0_#000]"
            style={{
              background: `conic-gradient(${gradient})`,
              transform: `rotate(${rotation}deg)`,
              transition: `transform ${spin?.spinDurationMs ?? config.spinDurationMs}ms cubic-bezier(.12,.82,.16,1)`,
            }}
          >
            <div className="absolute inset-[13%] rounded-full border-[6px] border-black bg-[#fff6db]" />
            <div className="absolute inset-[39%] rounded-full border-[5px] border-black bg-white" />
          </div>
        </div>

        <div className="border-[5px] border-black bg-[#fff6db] p-7 shadow-[12px_12px_0_#000]">
          <p className="text-xs font-black uppercase tracking-[0.28em]">{config.title}</p>
          <h1
            className="mt-3 text-5xl font-black uppercase leading-none lg:text-6xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {visibleSpin ? visibleSpin.label : "Pronta para girar"}
          </h1>
          <p className="mt-4 border-[3px] border-black px-4 py-2 text-sm font-black uppercase tracking-[0.18em]" style={{ backgroundColor: visibleSpin?.color ?? "#41d1ff" }}>
            {visibleSpin ? "Resultado final" : `${activeOptions.length} opções ativas`}
          </p>
        </div>
      </section>
    </div>
  );
}
