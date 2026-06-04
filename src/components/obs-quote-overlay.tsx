"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type QuoteOverlayPayload = {
  slot: string;
  overlayId: string;
  quoteNumber: number;
  quoteBody: string;
  createdByDisplayName: string;
  createdByYoutubeHandle: string | null;
  requestedByViewerId: string;
  requestedByDisplayName: string;
  requestedByYoutubeHandle: string | null;
  source: string;
  cost: number;
  activatedAt: string;
  expiresAt: string;
};

type LiveStatusPayload = {
  isLive: boolean;
};

const QUOTE_POLL_INTERVAL_MS = 200;
const LIVE_STATUS_POLL_INTERVAL_MS = 5_000;

const DEMO_OVERLAY: QuoteOverlayPayload = {
  slot: "obs_main",
  overlayId: "demo-overlay",
  quoteNumber: 7,
  quoteBody: "isso aqui vai dar muito certo, confia",
  createdByDisplayName: "Ana Neon",
  createdByYoutubeHandle: "@ananeon",
  requestedByViewerId: "viewer_demo",
  requestedByDisplayName: "Lia Pixel",
  requestedByYoutubeHandle: "@liapixel",
  source: "demo",
  cost: 50,
  activatedAt: "2026-04-13T00:00:00.000Z",
  expiresAt: "2026-04-13T00:00:12.000Z",
};

let quoteOverlayAudioContext: AudioContext | null = null;

async function playQuoteOverlayChime() {
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return;
  }

  quoteOverlayAudioContext ??= new AudioContextCtor();

  if (quoteOverlayAudioContext.state === "suspended") {
    await quoteOverlayAudioContext.resume();
  }

  const notes = [
    { frequency: 523.25, duration: 0.11, gain: 0.03 },
    { frequency: 659.25, duration: 0.12, gain: 0.035, delay: 0.08 },
    { frequency: 783.99, duration: 0.18, gain: 0.04, delay: 0.17 },
  ];
  const startAt = quoteOverlayAudioContext.currentTime + 0.02;

  notes.forEach((note) => {
    const oscillator = quoteOverlayAudioContext!.createOscillator();
    const gainNode = quoteOverlayAudioContext!.createGain();
    const noteStart = startAt + (note.delay ?? 0);
    const noteEnd = noteStart + note.duration;

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(note.frequency, noteStart);
    gainNode.gain.setValueAtTime(0.0001, noteStart);
    gainNode.gain.exponentialRampToValueAtTime(note.gain, noteStart + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(gainNode);
    gainNode.connect(quoteOverlayAudioContext!.destination);

    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.02);
  });
}

export function ObsQuoteOverlay() {
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "1";
  const [liveOverlay, setLiveOverlay] = useState<QuoteOverlayPayload | null>(null);
  const [isLive, setIsLive] = useState(false);
  const lastPlayedOverlayId = useRef<string | null>(null);

  useEffect(() => {
    if (isDemo) {
      return undefined;
    }

    let cancelled = false;
    let timeout: number | undefined;

    async function loadLiveStatus() {
      try {
        const response = await fetch("/api/obs/live-status", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) {
            setIsLive(false);
            setLiveOverlay(null);
          }
          return;
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data: LiveStatusPayload;
        };

        if (!cancelled) {
          setIsLive(Boolean(payload.data?.isLive));
          if (!payload.data?.isLive) {
            setLiveOverlay(null);
          }
        }
      } catch {
        if (!cancelled) {
          setIsLive(false);
          setLiveOverlay(null);
        }
      }
    }

    function scheduleLiveStatus() {
      timeout = window.setTimeout(() => {
        void loadLiveStatus().finally(() => {
          if (!cancelled) {
            scheduleLiveStatus();
          }
        });
      }, LIVE_STATUS_POLL_INTERVAL_MS);
    }

    void loadLiveStatus().finally(() => {
      if (!cancelled) {
        scheduleLiveStatus();
      }
    });

    return () => {
      cancelled = true;
      if (timeout) {
        window.clearTimeout(timeout);
      }
    };
  }, [isDemo]);

  useEffect(() => {
    if (isDemo || !isLive) {
      return undefined;
    }

    let cancelled = false;
    let timeout: number | undefined;

    async function loadOverlay() {
      try {
        const response = await fetch("/api/obs/quotes/current", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data: QuoteOverlayPayload | null;
        };

        if (!cancelled) {
          setLiveOverlay(payload.data ?? null);
        }
      } catch {
        if (!cancelled) {
          setLiveOverlay(null);
        }
      }
    }

    function scheduleOverlay() {
      timeout = window.setTimeout(() => {
        void loadOverlay().finally(() => {
          if (!cancelled) {
            scheduleOverlay();
          }
        });
      }, QUOTE_POLL_INTERVAL_MS);
    }

    void loadOverlay().finally(() => {
      if (!cancelled) {
        scheduleOverlay();
      }
    });

    return () => {
      cancelled = true;
      if (timeout) {
        window.clearTimeout(timeout);
      }
    };
  }, [isDemo, isLive]);

  const overlay = isDemo ? DEMO_OVERLAY : liveOverlay;

  useEffect(() => {
    if (!overlay?.overlayId) {
      return;
    }

    if (lastPlayedOverlayId.current === overlay.overlayId) {
      return;
    }

    lastPlayedOverlayId.current = overlay.overlayId;
    void playQuoteOverlayChime().catch(() => {
      // Autoplay can be blocked in regular browsers; OBS browser source is the main target.
    });
  }, [overlay?.overlayId]);

  return (
    <div className="pointer-events-none flex min-h-screen items-end justify-center p-6 sm:p-10 lg:p-14">
      {overlay ? (
        <section
          key={overlay.overlayId}
          className={`${isDemo ? "" : "quote-overlay-pop "}relative w-full max-w-[980px] overflow-hidden border-[4px] border-black bg-[#fff6db] text-black shadow-[12px_12px_0_#000]`}
          aria-live="polite"
        >
          <div className="absolute inset-0 opacity-25">
            <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,#ff66b3_0,transparent_24%),radial-gradient(circle_at_80%_30%,#41d1ff_0,transparent_20%),radial-gradient(circle_at_50%_80%,#00beae_0,transparent_22%)]" />
          </div>
          <div className="absolute inset-x-0 top-0 h-5 border-b-[4px] border-black bg-[repeating-linear-gradient(90deg,#000_0_28px,#ff66b3_28px_56px,#41d1ff_56px_84px,#00beae_84px_112px)]" />
          <div className="relative flex flex-col gap-6 px-6 pb-6 pt-10 sm:px-10 sm:pb-10 sm:pt-12">
            <div className="flex flex-col items-start gap-3 text-[11px] font-black uppercase tracking-[0.22em] sm:text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="border-[3px] border-black bg-black px-3 py-1 text-white">
                  Quote #{overlay.quoteNumber}
                </span>
                <span className="border-[3px] border-black bg-[#00beae] px-3 py-1">
                  criado por {overlay.createdByDisplayName}
                </span>
              </div>
            </div>

            <blockquote
              className="max-w-[20ch] text-[2rem] font-black uppercase leading-[0.94] tracking-[-0.04em] sm:text-[3.2rem] lg:text-[4.4rem]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {overlay.quoteBody}
            </blockquote>

            <div className="flex flex-wrap items-center gap-3 text-sm font-bold uppercase tracking-[0.12em] sm:text-base">
              {overlay.requestedByYoutubeHandle ? (
                <span className="border-[3px] border-black bg-[#ff66b3] px-3 py-1">
                  {overlay.requestedByYoutubeHandle}
                </span>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
