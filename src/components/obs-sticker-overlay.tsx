"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { readAlertSoundSettings, useAlertSound } from "@/lib/obs-alert-sound";
import { normalizeObsOverlayStyle, type ObsOverlayStyle } from "@/lib/obs-overlay-style";
import { safeYoutubeStickerUrl, type StickerAlert } from "@/lib/youtube-stickers";
import { readOverlayDuration, useObsAlertQueue } from "./use-obs-alert-queue";

function isStickerAlert(value: unknown): value is StickerAlert {
  const alert = value as StickerAlert | null;
  return typeof alert?.id === "string" && typeof alert.receivedAt === "string" && typeof alert.displayName === "string" &&
    typeof alert.amount === "string" && typeof alert.stickerAltText === "string";
}

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
  const duration = readOverlayDuration(params.get("duration"), 8000);
  const active = useObsAlertQueue({ creatorSlug, endpoint: "/api/obs/stickers/current", storageKey: "youtube-stickers:v1",
    duration, enabled: !demo, isAlert: isStickerAlert });

  const alert = demo ? {
    id: "demo", receivedAt: "", displayName: "Teste de Super Sticker", amount: "R$ 10,00",
    stickerAltText: "A imagem enviada pelo YouTube aparece aqui", stickerImageUrl: null,
  } : active;
  useAlertSound(alert?.id ?? null, readAlertSoundSettings(params));
  if (!alert) return null;
  return <main className="pointer-events-none fixed inset-0 flex items-end justify-center bg-transparent p-10">
    <section aria-live="polite" className={`flex max-w-2xl flex-col items-center gap-4 rounded-3xl px-8 py-6 text-white ${minimal ? "bg-black/75" : "bg-black/85"}`}>
      <StickerImage key={alert.id} alert={alert} />
      <p className="max-w-xl break-words text-center text-3xl font-black">{alert.displayName}</p>
      <p className={`text-xl font-bold ${minimal ? "text-amber-200" : "text-lime-300"}`}>Super Sticker{alert.amount ? ` · ${alert.amount}` : ""}</p>
    </section>
  </main>;
}
