"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { normalizeObsOverlayStyle, type ObsOverlayStyle } from "@/lib/obs-overlay-style";
import { safeYoutubeStickerUrl, stickerCursorSchema, STICKER_MAX_AGE_MS, type StickerAlert, type StickerBatch } from "@/lib/youtube-stickers";

function StickerImage({ alert }: { alert: StickerAlert }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = safeYoutubeStickerUrl(alert.stickerImageUrl);
  return imageUrl && !failed ? (
    // Preserve the original animated asset; image optimization can flatten animations.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt={alert.stickerAltText} referrerPolicy="no-referrer" onError={() => setFailed(true)}
      className="h-64 w-64 object-contain drop-shadow-lg" />
  ) : <p className="max-w-lg text-center text-3xl font-bold">{alert.stickerAltText}</p>;
}

export function ObsStickerOverlay({ creatorSlug, initialStyle = "classic" }: { creatorSlug: string; initialStyle?: ObsOverlayStyle }) {
  const params = useSearchParams();
  const demo = params.get("demo") === "1";
  const minimal = (normalizeObsOverlayStyle(params.get("style")) ?? initialStyle) === "obscur";
  const requestedDuration = Number(params.get("duration") ?? "8000");
  const duration = Number.isFinite(requestedDuration) ? Math.min(30_000, Math.max(3000, requestedDuration)) : 8000;
  const [active, setActive] = useState<{ creator: string; alert: StickerAlert } | null>(null);

  useEffect(() => {
    if (demo) return;
    const storageKey = `youtube-stickers:v1:${creatorSlug}`;
    let cursor: string | undefined;
    let queue: StickerAlert[] = [];
    let stopped = false;
    let displaying = false;
    let verified = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let displayTimer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (saved && stickerCursorSchema.safeParse(saved.cursor).success) {
        cursor = saved.cursor;
        if (Array.isArray(saved.queue)) queue = saved.queue.filter((alert: StickerAlert) =>
          typeof alert?.id === "string" && typeof alert.displayName === "string" && typeof alert.amount === "string" &&
          typeof alert.stickerAltText === "string" && Date.parse(alert.receivedAt) > Date.now() - STICKER_MAX_AGE_MS);
      }
    } catch { /* Storage is optional in embedded browsers. */ }
    function persist() {
      try { sessionStorage.setItem(storageKey, JSON.stringify({ cursor, queue })); } catch { /* Keep the in-memory queue. */ }
    }
    function showNext() {
      if (stopped || displaying) return;
      const alert = queue.shift();
      persist();
      if (!alert) return;
      displaying = true;
      setActive({ creator: creatorSlug, alert });
      displayTimer = setTimeout(() => {
        displaying = false;
        setActive(null);
        showNext();
      }, duration);
    }
    async function poll() {
      if (stopped) return;
      try {
        // Backpressure: leave the remaining events in the server feed while OBS catches up.
        if (verified && queue.length >= 100) return;
        const query = new URLSearchParams({ creator: creatorSlug });
        if (cursor) query.set("cursor", cursor);
        controller = new AbortController();
        const response = await fetch(`/api/obs/stickers/current?${query}`, { cache: "no-store", signal: controller.signal });
        if (stopped) return;
        if (response.status === 403 || response.status === 404) {
          queue = [];
          clearTimeout(displayTimer);
          displaying = false;
          verified = false;
          setActive(null);
          persist();
          return;
        }
        if (!response.ok) return;
        const payload = await response.json() as { ok?: boolean; data?: StickerBatch };
        if (stopped || !payload.ok || !payload.data || !stickerCursorSchema.safeParse(payload.data.cursor).success || !Array.isArray(payload.data.alerts)) return;
        cursor = payload.data.cursor;
        verified = true;
        queue.push(...payload.data.alerts);
        persist();
        showNext();
      } catch { /* Retry transient failures without discarding accepted alerts. */ }
      finally { if (!stopped) pollTimer = setTimeout(poll, 2000); }
    }
    // Verify access before resuming a saved queue.
    void poll();
    return () => {
      stopped = true;
      controller?.abort();
      clearTimeout(pollTimer);
      clearTimeout(displayTimer);
    };
  }, [creatorSlug, demo, duration]);

  const alert = demo ? {
    id: "demo", receivedAt: "", displayName: "Teste de Super Sticker", amount: "R$ 10,00",
    stickerAltText: "A imagem enviada pelo YouTube aparece aqui", stickerImageUrl: null,
  } : active?.creator === creatorSlug ? active.alert : null;
  if (!alert) return null;
  return <main className="pointer-events-none fixed inset-0 flex items-end justify-center bg-transparent p-10">
    <section aria-live="polite" className={`flex max-w-2xl flex-col items-center gap-4 rounded-3xl px-8 py-6 text-white ${minimal ? "bg-black/75" : "bg-black/85"}`}>
      <StickerImage key={alert.id} alert={alert} />
      <p className="max-w-xl break-words text-center text-3xl font-black">{alert.displayName}</p>
      <p className={`text-xl font-bold ${minimal ? "text-amber-200" : "text-lime-300"}`}>Super Sticker{alert.amount ? ` · ${alert.amount}` : ""}</p>
    </section>
  </main>;
}
