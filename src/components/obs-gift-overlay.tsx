"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { readAlertSoundSettings, useAlertSound } from "@/lib/obs-alert-sound";
import { normalizeObsOverlayStyle, type ObsOverlayStyle } from "@/lib/obs-overlay-style";
import { formatJewels, isGiftAlert, mergeGiftCombo, type GiftAlert } from "@/lib/youtube-gifts";
import { safeYoutubeStickerUrl } from "@/lib/youtube-stickers";
import { readOverlayDuration, useObsAlertQueue } from "./use-obs-alert-queue";

function GiftImage({ alert }: { alert: GiftAlert }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = safeYoutubeStickerUrl(alert.giftImageUrl);
  return imageUrl && !failed ? (
    // Keep the original asset untouched; image optimization can flatten animations.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt={alert.giftName} referrerPolicy="no-referrer" onError={() => setFailed(true)}
      className="h-56 w-56 object-contain drop-shadow-lg" />
  ) : <p className="max-w-lg text-center text-4xl font-black">{alert.giftName}</p>;
}

export function ObsGiftOverlay({ creatorSlug, initialStyle = "classic" }: { creatorSlug: string; initialStyle?: ObsOverlayStyle }) {
  const params = useSearchParams();
  const demo = params.get("demo") === "1";
  const minimal = (normalizeObsOverlayStyle(params.get("style")) ?? initialStyle) === "obscur";
  const duration = readOverlayDuration(params.get("duration"), 6000);
  const active = useObsAlertQueue({ creatorSlug, endpoint: "/api/obs/gifts/current", storageKey: "youtube-gifts:v1",
    duration, enabled: !demo, isAlert: isGiftAlert, merge: mergeGiftCombo });

  const alert: GiftAlert | null = demo ? {
    id: "demo", receivedAt: "", displayName: "Teste de presente", giftName: "O presente enviado aparece aqui",
    giftImageUrl: null, jewelsAmount: 10, comboCount: 3,
  } : active;
  useAlertSound(alert?.id ?? null, readAlertSoundSettings(params));
  if (!alert) return null;
  return <main className="pointer-events-none fixed inset-0 flex items-end justify-center bg-transparent p-10">
    <section aria-live="polite" className={`relative flex max-w-2xl flex-col items-center gap-3 rounded-3xl px-8 py-6 text-white ${minimal ? "bg-black/75" : "bg-black/85"}`}>
      <GiftImage key={`${alert.id}:${alert.giftImageUrl}`} alert={alert} />
      {alert.comboCount > 1 ? <p key={alert.comboCount} className={`sticker-pop absolute right-6 top-4 text-5xl font-black ${minimal ? "text-amber-200" : "text-lime-300"}`}>
        ×{alert.comboCount}
      </p> : null}
      <p className="max-w-xl break-words text-center text-3xl font-black">{alert.displayName}</p>
      <p className={`max-w-xl break-words text-center text-xl font-bold ${minimal ? "text-amber-200" : "text-lime-300"}`}>
        {alert.giftName}{alert.jewelsAmount ? ` · ${formatJewels(alert.jewelsAmount)}` : ""}
      </p>
    </section>
  </main>;
}
