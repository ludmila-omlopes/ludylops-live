"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Gamepad2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compareCommunityGames, gameDetails, type CommunityGame, type CommunityGameBoard, type CommunityGameStatus } from "@/lib/creators/games";

const votesLabel = (votes: number) => (votes === 1 ? "1 voto" : `${votes.toLocaleString("pt-BR")} votos`);

const actions: Record<CommunityGameStatus, { status: CommunityGameStatus; label: string; variant: "default" | "neutral" }[]> = {
  open: [{ status: "accepted", label: "Vou jogar", variant: "default" }, { status: "rejected", label: "Recusar", variant: "neutral" }],
  accepted: [{ status: "played", label: "Marcar como jogado", variant: "default" }, { status: "open", label: "Voltar para a votação", variant: "neutral" }],
  played: [{ status: "accepted", label: "Ainda vou jogar", variant: "neutral" }],
  rejected: [{ status: "open", label: "Voltar para a votação", variant: "neutral" }],
};

const groups: { status: CommunityGameStatus; title: string; empty: string }[] = [
  { status: "accepted", title: "Vai jogar", empty: "Nenhum jogo escolhido ainda. Escolha um dos mais votados." },
  { status: "open", title: "Em votação", empty: "Nenhum jogo em votação. Conte ao seu público que ele pode sugerir jogos para você." },
  { status: "played", title: "Já jogados", empty: "Nenhum jogo marcado como jogado ainda." },
  { status: "rejected", title: "Recusados", empty: "Nenhum jogo recusado." },
];

const sortBoard = (board: CommunityGameBoard): CommunityGameBoard =>
  ({ ...board, open: [...board.open].sort(compareCommunityGames), accepted: [...board.accepted].sort(compareCommunityGames) });

export function CommunityGamesManager({ creatorId, initial }: { creatorId: string; initial: CommunityGameBoard }) {
  const [board, setBoard] = useState(() => sortBoard(initial));
  const [multiplier, setMultiplier] = useState(String(initial.ownedGameMultiplier));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const endpoint = `/api/me/creator-area/${encodeURIComponent(creatorId)}/games`;

  async function move(game: CommunityGame, status?: CommunityGameStatus, isOwned?: boolean) {
    setBusy(game.id); setMessage(null);
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ suggestionId: game.id, status, isOwned }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível atualizar o jogo.");
      const updated = payload.data as CommunityGame;
      setBoard((current) => {
        const without = (list: CommunityGame[]) => list.filter((entry) => entry.id !== updated.id);
        const next = { ...current, accepted: without(current.accepted), open: without(current.open), played: without(current.played), rejected: without(current.rejected) };
        next[updated.status] = [updated, ...next[updated.status]];
        return sortBoard(next);
      });
      setMessage({ text: status ? { accepted: "Jogo na lista para jogar.", played: "Jogo marcado como jogado.", rejected: "Jogo recusado.", open: "Jogo de volta à votação." }[status]
        : isOwned ? "Jogo marcado como seu." : "Marcação removida.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Não foi possível atualizar o jogo.", error: true });
    } finally { setBusy(null); }
  }

  async function saveMultiplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("settings"); setMessage(null);
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownedGameMultiplier: Number(multiplier) }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível salvar o bônus.");
      setBoard(sortBoard(payload.data)); setMultiplier(String(payload.data.ownedGameMultiplier));
      setMessage({ text: "Bônus atualizado.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Não foi possível salvar o bônus.", error: true });
    } finally { setBusy(null); }
  }

  return (
    <div className="grid gap-8">
      <form onSubmit={saveMultiplier} className="hub-card grid gap-4 p-6">
        <h2 className="hub-h2">Bônus para jogos que já possuo</h2>
        <p className="hub-muted text-sm">Aumente a prioridade dos jogos que você já tem. Os votos continuam iguais. Use 1 para não dar bônus.</p>
        <label className="grid max-w-xs gap-2 text-sm font-semibold">Multiplicador
          <Input type="number" min={0} max={10} step={0.05} required value={multiplier}
            disabled={busy !== null} onChange={(event) => setMultiplier(event.target.value)} />
        </label>
        <div><Button type="submit" size="sm" disabled={busy !== null}>{busy === "settings" ? "Salvando…" : "Salvar bônus"}</Button></div>
      </form>
      {message ? <p role={message.error ? "alert" : "status"} className="text-sm">{message.text}</p> : null}
      {groups.map((group) => (
        <section key={group.status} aria-labelledby={`jogos-${group.status}`} className="hub-card grid gap-4 p-6">
          <h2 id={`jogos-${group.status}`} className="hub-h2">{group.title}</h2>
          {!board[group.status].length ? <p className="hub-muted text-sm">{group.empty}</p> : (
            <ol className="grid gap-3">
              {board[group.status].map((game) => {
                const details = gameDetails(game);
                return (
                  <li key={game.id} className="hub-well flex min-w-0 gap-4 p-4">
                    {game.coverImageUrl
                      ? <img src={game.coverImageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[3/4] w-16 shrink-0 rounded object-cover" />
                      : <span aria-hidden="true" className="grid aspect-[3/4] w-16 shrink-0 place-items-center rounded bg-[var(--hub-edge-2)]"><Gamepad2 className="size-5" /></span>}
                    <div className="grid min-w-0 flex-1 content-start gap-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="min-w-0 break-words font-semibold">{game.name}</h3>
                        <span className="hub-chip">{votesLabel(game.votes)}</span>
                      </div>
                      {details ? <p className="hub-muted break-words text-sm">{details}</p> : null}
                      <p className="hub-muted break-words text-sm">Sugerido por {game.suggestedBy}</p>
                      {game.isOwned ? <p className="text-sm font-semibold">Já possuo · {game.ownedGameMultiplier.toLocaleString("pt-BR")}x</p> : null}
                      {game.boostedScore !== game.votes ? <p className="text-sm font-semibold">Prioridade: {game.boostedScore.toLocaleString("pt-BR")}</p> : null}
                      {game.reason ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{game.reason}</p> : null}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button type="button" size="sm" variant="neutral" aria-pressed={game.isOwned} disabled={busy !== null}
                          onClick={() => void move(game, undefined, !game.isOwned)}>
                          {game.isOwned ? "Já possuo · desmarcar" : "Marcar como já possuo"}
                        </Button>
                        {actions[game.status].map((action) => (
                          <Button key={action.status} type="button" size="sm" variant={action.variant} disabled={busy !== null}
                            onClick={() => void move(game, action.status)}>
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
