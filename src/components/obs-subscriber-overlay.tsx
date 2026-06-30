"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getObsOverlayStyle, type ObsOverlayStyle } from "@/lib/obs-overlay-style";
import type { SubscriberAlertRecord } from "@/lib/types";

const DEFAULT_DURATION_MS = 7000;

const DEMO_ALERTS: SubscriberAlertRecord[] = [
  {
    eventId: "demo-sub-1",
    viewerExternalId: "UC-DEMO-1",
    displayName: "Lia Pixel",
    youtubeHandle: "@liapixel",
    occurredAt: "2026-06-01T21:00:00.000Z",
    broadcastId: "demo-live",
  },
  {
    eventId: "demo-sub-2",
    viewerExternalId: "UC-DEMO-2",
    displayName: "Ana Neon",
    youtubeHandle: "@ananeon",
    occurredAt: "2026-06-01T21:00:09.000Z",
    broadcastId: "demo-live",
  },
];

let subscriberAudioContext: AudioContext | null = null;

function clampDuration(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_DURATION_MS;
  }
  return Math.min(Math.max(Math.floor(parsed), 3000), 20000);
}

function readParam(searchParams: ReturnType<typeof useSearchParams>, keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key)?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

async function playSubscriberChime() {
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return;
  }

  subscriberAudioContext ??= new AudioContextCtor();

  if (subscriberAudioContext.state === "suspended") {
    await subscriberAudioContext.resume();
  }

  const startAt = subscriberAudioContext.currentTime + 0.02;
  const notes = [
    { frequency: 392, delay: 0, duration: 0.14, gain: 0.045 },
    { frequency: 523.25, delay: 0.1, duration: 0.16, gain: 0.05 },
    { frequency: 659.25, delay: 0.22, duration: 0.2, gain: 0.052 },
    { frequency: 783.99, delay: 0.36, duration: 0.22, gain: 0.045 },
  ];

  notes.forEach((note) => {
    const oscillator = subscriberAudioContext!.createOscillator();
    const gainNode = subscriberAudioContext!.createGain();
    const noteStart = startAt + note.delay;
    const noteEnd = noteStart + note.duration;

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(note.frequency, noteStart);
    gainNode.gain.setValueAtTime(0.0001, noteStart);
    gainNode.gain.exponentialRampToValueAtTime(note.gain, noteStart + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(gainNode);
    gainNode.connect(subscriberAudioContext!.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.03);
  });
}

async function playAlertSound(soundUrl: string | null, volume: number) {
  if (soundUrl) {
    const audio = new Audio(soundUrl);
    audio.volume = volume;
    await audio.play();
    return;
  }

  await playSubscriberChime();
}

export function ObsSubscriberOverlay({ initialStyle = "classic" }: { initialStyle?: ObsOverlayStyle }) {
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "1";
  const isObscurStyle = (getObsOverlayStyle(searchParams) ?? initialStyle) === "obscur";
  const durationMs = clampDuration(readParam(searchParams, ["durationMs", "duration"]));
  const imageUrl = readParam(searchParams, ["imageUrl", "image"]);
  const soundUrl = readParam(searchParams, ["soundUrl", "sound"]);
  const title = readParam(searchParams, ["title"]) ?? "Nova inscrição";
  const subtitle = readParam(searchParams, ["subtitle"]) ?? "chegou no canal";
  const rawVolume = Number(searchParams.get("volume") ?? "0.8");
  const volume = Number.isFinite(rawVolume) ? Math.min(Math.max(rawVolume, 0), 1) : 0.8;
  const [alerts, setAlerts] = useState<SubscriberAlertRecord[]>(isDemo ? DEMO_ALERTS : []);
  const currentAlert = alerts[0] ?? null;
  const seenEventIds = useRef(new Set<string>());
  const lastDemoCycleAt = useRef(0);

  useEffect(() => {
    if (isDemo) {
      return undefined;
    }

    let cancelled = false;

    async function loadAlerts() {
      try {
        const response = await fetch("/api/obs/subscribers/current", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data: SubscriberAlertRecord[];
        };

        if (cancelled) {
          return;
        }

        const nextAlerts = payload.data.filter((alert) => !seenEventIds.current.has(alert.eventId));
        nextAlerts.forEach((alert) => seenEventIds.current.add(alert.eventId));
        if (nextAlerts.length > 0) {
          setAlerts((current) => [...current, ...nextAlerts].slice(-20));
        }
      } catch {
        // Keep the current queue; the next poll can recover.
      }
    }

    void loadAlerts();
    const interval = window.setInterval(() => {
      void loadAlerts();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isDemo]);

  useEffect(() => {
    if (!isDemo) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      const now = Date.now();
      if (alerts.length === 0 && now - lastDemoCycleAt.current > 1500) {
        lastDemoCycleAt.current = now;
        setAlerts(
          DEMO_ALERTS.map((alert) => ({
            ...alert,
            eventId: `${alert.eventId}-${now}`,
          })),
        );
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [alerts.length, isDemo]);

  useEffect(() => {
    if (!currentAlert) {
      return undefined;
    }

    void playAlertSound(soundUrl, volume).catch(() => {
      // Browser autoplay can block audio outside OBS; visual alert still works.
    });

    const timeout = window.setTimeout(() => {
      setAlerts((current) =>
        current[0]?.eventId === currentAlert.eventId ? current.slice(1) : current,
      );
    }, durationMs);

    return () => window.clearTimeout(timeout);
  }, [currentAlert, durationMs, soundUrl, volume]);

  if (isObscurStyle) {
    return (
      <div className="pointer-events-none flex min-h-screen items-end justify-start p-5 text-[#f8ecd4] sm:p-8 lg:p-10">
        {currentAlert ? (
          <section
            key={currentAlert.eventId}
            className="obscur-subscriber-pop relative flex w-fit max-w-[min(620px,92vw)] items-center gap-4 overflow-hidden border-l border-[#d8b46a]/80 bg-[linear-gradient(90deg,rgba(7,7,10,0.76),rgba(7,7,10,0.40)_72%,rgba(7,7,10,0.02))] px-5 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-[2px]"
            style={{ animationDuration: `${durationMs}ms` }}
            aria-live="polite"
          >
            <div className="absolute inset-y-3 left-2 w-px bg-[#f3d58b]/60" />
            {imageUrl ? (
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="aspect-square w-16 border border-[#d8b46a]/70 object-cover shadow-[0_12px_30px_rgba(0,0,0,0.4)] sm:w-20"
                />
              </div>
            ) : null}
            <div className="relative min-w-0">
              <h1
                className="max-w-[18ch] break-words text-[1.8rem] font-semibold leading-none [text-shadow:0_2px_18px_rgba(0,0,0,0.88)] sm:text-[2.5rem] lg:text-[3rem]"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {currentAlert.displayName}
              </h1>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-[#d8b46a] [text-shadow:0_2px_14px_rgba(0,0,0,0.9)] sm:text-base">
                <span>
                  {title} - {subtitle}
                </span>
                {currentAlert.youtubeHandle ? <span>{currentAlert.youtubeHandle}</span> : null}
              </p>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pointer-events-none flex min-h-screen items-end justify-center p-6 sm:p-10 lg:p-14">
      {currentAlert ? (
        <section
          key={currentAlert.eventId}
          className={`subscriber-overlay-pop relative grid w-full max-w-[980px] overflow-hidden border-[4px] border-black bg-[#fff6db] text-black shadow-[12px_12px_0_#000] ${imageUrl ? "sm:grid-cols-[220px_1fr]" : ""}`}
          style={{ animationDuration: `${durationMs}ms` }}
          aria-live="polite"
        >
          <div className="absolute inset-x-0 top-0 h-5 border-b-[4px] border-black bg-[repeating-linear-gradient(90deg,#000_0_28px,#ff66b3_28px_56px,#41d1ff_56px_84px,#00beae_84px_112px,#ffe066_112px_140px)]" />

          {imageUrl ? (
            <div className="relative flex min-h-[220px] items-center justify-center border-b-[4px] border-black bg-[#41d1ff] p-5 pt-10 sm:border-b-0 sm:border-r-[4px]">
              <div className="absolute inset-4 border-[3px] border-black bg-[#ffe066]" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                className="relative aspect-square w-full max-w-[170px] border-[4px] border-black bg-white object-cover shadow-[8px_8px_0_#000]"
              />
            </div>
          ) : null}

          <div className="relative flex flex-col gap-5 px-6 pb-6 pt-10 sm:px-10 sm:pb-10 sm:pt-12">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.22em] sm:text-xs">
              <span className="border-[3px] border-black bg-black px-3 py-1 text-white">
                {title}
              </span>
              {currentAlert.youtubeHandle ? (
                <span className="border-[3px] border-black bg-[#00beae] px-3 py-1">
                  {currentAlert.youtubeHandle}
                </span>
              ) : null}
            </div>

            <h1
              className="max-w-[18ch] break-words text-[2.4rem] font-black uppercase leading-[0.94] sm:text-[3.4rem] lg:text-[4.8rem]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {currentAlert.displayName}
            </h1>

            <p className="w-fit max-w-full border-[3px] border-black bg-[#ff66b3] px-4 py-2 text-lg font-black uppercase leading-tight sm:text-2xl">
              {subtitle}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
