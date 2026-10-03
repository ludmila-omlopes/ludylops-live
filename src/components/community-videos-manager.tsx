"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CommunityVideo, CommunityVideoBoard, CommunityVideoStatus } from "@/lib/creators/videos";

const votesLabel = (votes: number) => (votes === 1 ? "1 voto" : `${votes.toLocaleString("pt-BR")} votos`);

const actions: Record<CommunityVideoStatus, { status: CommunityVideoStatus; label: string; variant: "default" | "neutral" }[]> = {
  open: [{ status: "reacted", label: "Marcar como reagido", variant: "default" }, { status: "rejected", label: "Recusar", variant: "neutral" }],
  reacted: [{ status: "open", label: "Voltar para a fila", variant: "neutral" }],
  rejected: [{ status: "open", label: "Voltar para a fila", variant: "neutral" }],
};

const groups: { status: CommunityVideoStatus; title: string; empty: string }[] = [
  { status: "open", title: "Na fila", empty: "Nenhum vídeo na fila. Conte ao seu público que ele pode mandar vídeos para você reagir." },
  { status: "reacted", title: "Já reagidos", empty: "Nenhum vídeo marcado como reagido ainda." },
  { status: "rejected", title: "Recusados", empty: "Nenhum vídeo recusado." },
];

function sortBoard(board: CommunityVideoBoard): CommunityVideoBoard {
  return { ...board, open: [...board.open].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt)) };
}

export function CommunityVideosManager({ creatorId, initial }: { creatorId: string; initial: CommunityVideoBoard }) {
  const [board, setBoard] = useState(() => sortBoard(initial));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const endpoint = `/api/me/creator-area/${encodeURIComponent(creatorId)}/videos`;

  async function move(video: CommunityVideo, status: CommunityVideoStatus) {
    setBusy(video.id); setMessage(null);
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ suggestionId: video.id, status }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível atualizar o vídeo.");
      const updated = payload.data as CommunityVideo;
      setBoard((current) => {
        const without = (list: CommunityVideo[]) => list.filter((entry) => entry.id !== updated.id);
        const next = { open: without(current.open), reacted: without(current.reacted), rejected: without(current.rejected) };
        next[updated.status] = updated.status === "open" ? [...next.open, updated] : [updated, ...next[updated.status]];
        return sortBoard(next);
      });
      setMessage({ text: status === "reacted" ? "Vídeo marcado como reagido." : status === "rejected" ? "Vídeo recusado." : "Vídeo de volta à fila.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Não foi possível atualizar o vídeo.", error: true });
    } finally { setBusy(null); }
  }

  return (
    <div className="grid gap-8">
      {message ? <p role={message.error ? "alert" : "status"} className="text-sm">{message.text}</p> : null}
      {groups.map((group) => (
        <section key={group.status} aria-labelledby={`videos-${group.status}`} className="hub-card grid gap-4 p-6">
          <h2 id={`videos-${group.status}`} className="hub-h2">{group.title}</h2>
          {!board[group.status].length ? <p className="hub-muted text-sm">{group.empty}</p> : (
            <ol className="grid gap-3">
              {board[group.status].map((video) => (
                <li key={video.id} className="hub-well grid min-w-0 gap-3 p-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${video.title} no YouTube`}>
                    <img src={video.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-video w-full rounded-md object-cover" />
                  </a>
                  <div className="grid min-w-0 content-start gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="min-w-0 break-words font-semibold">{video.title}</h3>
                      <span className="hub-chip">{votesLabel(video.votes)}</span>
                    </div>
                    <p className="hub-muted break-words text-sm">{video.channelName} · sugerido por {video.suggestedBy}</p>
                    {video.reason ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{video.reason}</p> : null}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {actions[video.status].map((action) => (
                        <Button key={action.status} type="button" size="sm" variant={action.variant} disabled={busy !== null}
                          onClick={() => void move(video, action.status)}>
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
