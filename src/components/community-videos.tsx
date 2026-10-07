"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ThumbsUp } from "lucide-react";

import { CommunityBoost } from "@/components/community-boost";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CommunityWallet } from "@/lib/creators/community-boosts";
import type { CommunityVideo, CommunityVideoBoard } from "@/lib/creators/videos";

const cardClass = "hub-card flex min-w-0 flex-col gap-4 border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5";
const votesLabel = (votes: number) => (votes === 1 ? "1 voto" : `${votes.toLocaleString("pt-BR")} votos`);

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível falar com a comunidade agora.");
  return payload.data as CommunityVideo;
}

function VideoThumb({ video }: { video: CommunityVideo }) {
  return (
    <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden" aria-label={`Abrir ${video.title} no YouTube`}>
      <img src={video.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-video w-full object-cover" />
    </a>
  );
}

export function CommunityVideos({ slug, board, signedIn, signInHref, wallet }: {
  slug: string;
  board: CommunityVideoBoard;
  signedIn: boolean;
  signInHref: string;
  /** The signed-in viewer's balance where the community currency is on. */
  wallet?: CommunityWallet | null;
}) {
  const [open, setOpen] = useState(board.open);
  const [currentWallet, setWallet] = useState(wallet ?? null);
  const [videoUrl, setVideoUrl] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const base = `/api/c/${encodeURIComponent(slug)}/videos`;

  async function suggest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("suggest"); setMessage(null);
    try {
      const created = await send(base, "POST", { videoUrl, reason: reason || undefined });
      setOpen((current) => [...current, created]);
      setVideoUrl(""); setReason("");
      setMessage({ text: "Vídeo sugerido. Seu voto já conta.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Não foi possível sugerir o vídeo.", error: true });
    } finally { setBusy(null); }
  }

  async function vote(video: CommunityVideo) {
    setBusy(video.id); setMessage(null);
    try {
      const updated = await send(`${base}/${encodeURIComponent(video.id)}/vote`, video.voted ? "DELETE" : "POST");
      setOpen((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Não foi possível registrar seu voto.", error: true });
    } finally { setBusy(null); }
  }

  const ranked = [...open].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="grid gap-10">
      {signedIn ? (
        <form onSubmit={suggest} className={`${cardClass} max-w-2xl`}>
          <h2 className="text-2xl font-black">Sugerir um vídeo</h2>
          <label className="grid gap-2 text-sm font-bold">Link do YouTube
            <Input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} required maxLength={500}
              inputMode="url" placeholder="https://www.youtube.com/watch?v=…" disabled={busy !== null} />
          </label>
          <label className="grid gap-2 text-sm font-bold">Por que vale a reação? (opcional)
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} disabled={busy !== null} />
          </label>
          <div><Button type="submit" disabled={busy !== null}>{busy === "suggest" ? "Enviando…" : "Sugerir vídeo"}</Button></div>
        </form>
      ) : (
        <p><a className="font-bold underline" href={signInHref}>Entre para sugerir vídeos e votar</a></p>
      )}
      {message ? <p role={message.error ? "alert" : "status"} className="text-sm font-bold">{message.text}</p> : null}

      <section aria-labelledby="videos-na-fila" className="grid gap-6">
        <h2 id="videos-na-fila" className="text-3xl font-black">Na fila</h2>
        {!ranked.length ? <p>Nenhum vídeo na fila ainda. Que tal sugerir o primeiro?</p> : (
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map((video) => (
              <li key={video.id} className={cardClass}>
                <VideoThumb video={video} />
                <div className="grid min-w-0 gap-1">
                  <h3 className="break-words text-lg font-black leading-snug">{video.title}</h3>
                  <p className="hub-muted break-words text-sm">{video.channelName} · sugerido por {video.suggestedBy}</p>
                </div>
                {video.reason ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{video.reason}</p> : null}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                  <p className="text-sm font-bold">{votesLabel(video.votes)}</p>
                  {signedIn ? (
                    <Button type="button" size="sm" variant={video.voted ? "neutral" : "default"} aria-pressed={video.voted}
                      disabled={busy !== null} onClick={() => void vote(video)}>
                      <ThumbsUp className="size-4" aria-hidden="true" />
                      {video.voted ? "Votado" : "Votar"}
                    </Button>
                  ) : null}
                  {signedIn && currentWallet ? (
                    <CommunityBoost<CommunityVideo> endpoint={`${base}/${encodeURIComponent(video.id)}/boost`} wallet={currentWallet} disabled={busy !== null}
                      onBoosted={(updated, next) => { setOpen((current) => current.map((entry) => (entry.id === updated.id ? updated : entry))); setWallet(next); }} />
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {board.reacted.length ? (
        <section aria-labelledby="videos-reagidos" className="grid gap-6">
          <h2 id="videos-reagidos" className="text-3xl font-black">Já ganharam reação</h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {board.reacted.map((video) => (
              <li key={video.id} className={cardClass}>
                <VideoThumb video={video} />
                <div className="grid min-w-0 gap-1">
                  <h3 className="break-words text-lg font-black leading-snug">{video.title}</h3>
                  <p className="hub-muted break-words text-sm">{video.channelName} · {votesLabel(video.votes)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
