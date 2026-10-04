"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { Gamepad2, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { gameDetails, type CommunityGame, type CommunityGameBoard, type CommunityGameSearchResult } from "@/lib/creators/games";

const cardClass = "hub-card flex min-w-0 flex-col gap-4 border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5";
const votesLabel = (votes: number) => (votes === 1 ? "1 voto" : `${votes.toLocaleString("pt-BR")} votos`);

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível falar com a comunidade agora.");
  return payload.data;
}

function Cover({ game, small = false }: { game: Pick<CommunityGame, "coverImageUrl" | "name">; small?: boolean }) {
  const size = small ? "w-12" : "w-20";
  return game.coverImageUrl
    ? <img src={game.coverImageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className={`${size} aspect-[3/4] shrink-0 rounded object-cover`} />
    : <span aria-hidden="true" className={`${size} grid aspect-[3/4] shrink-0 place-items-center rounded bg-[var(--hub-edge-2,rgb(0_0_0/0.08))]`}><Gamepad2 className="size-5" /></span>;
}

function GameCard({ game, children }: { game: CommunityGame; children?: React.ReactNode }) {
  const details = gameDetails(game);
  return (
    <li className={cardClass}>
      <div className="flex min-w-0 gap-4">
        <Cover game={game} />
        <div className="grid min-w-0 content-start gap-1">
          <h3 className="break-words text-lg font-black leading-snug">{game.name}</h3>
          {details ? <p className="hub-muted break-words text-sm">{details}</p> : null}
          <p className="hub-muted break-words text-sm">Sugerido por {game.suggestedBy}</p>
        </div>
      </div>
      {game.reason ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{game.reason}</p> : null}
      {children}
    </li>
  );
}

export function CommunityGames({ slug, board, signedIn, signInHref }: {
  slug: string;
  board: CommunityGameBoard;
  signedIn: boolean;
  signInHref: string;
}) {
  const [open, setOpen] = useState(board.open);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommunityGameSearchResult[]>([]);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ igdbId?: number; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const base = `/api/c/${encodeURIComponent(slug)}/games`;

  useEffect(() => {
    if (picked || query.trim().length < 2) { setResults([]); setSearchNote(null); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${base}/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) { setResults([]); setSearchNote(payload?.error ?? "A busca de jogos está indisponível agora. Digite o nome do jogo."); return; }
        setResults(payload.data); setSearchNote(payload.data.length ? null : "Nenhum jogo encontrado com esse nome.");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSearchNote("A busca de jogos está indisponível agora. Digite o nome do jogo.");
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [base, picked, query]);

  async function suggest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!picked) return;
    setBusy("suggest"); setMessage(null);
    try {
      const created = await send(base, "POST", { ...picked, reason: reason || undefined }) as CommunityGame;
      setOpen((current) => [...current, created]);
      setPicked(null); setQuery(""); setReason("");
      setMessage({ text: "Jogo sugerido. Seu voto já conta.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Não foi possível sugerir o jogo.", error: true });
    } finally { setBusy(null); }
  }

  async function vote(game: CommunityGame) {
    setBusy(game.id); setMessage(null);
    try {
      const updated = await send(`${base}/${encodeURIComponent(game.id)}/vote`, game.voted ? "DELETE" : "POST") as CommunityGame;
      setOpen((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Não foi possível registrar seu voto.", error: true });
    } finally { setBusy(null); }
  }

  const ranked = [...open].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt));
  const typed = query.trim();

  return (
    <div className="grid gap-10">
      {board.accepted.length ? (
        <section aria-labelledby="jogos-vai-jogar" className="grid gap-6">
          <h2 id="jogos-vai-jogar" className="text-3xl font-black">Vai jogar</h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{board.accepted.map((game) => <GameCard key={game.id} game={game} />)}</ul>
        </section>
      ) : null}

      {signedIn ? (
        <form onSubmit={suggest} className={`${cardClass} max-w-2xl`}>
          <h2 className="text-2xl font-black">Sugerir um jogo</h2>
          {picked ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-bold">{picked.name}</p>
              <Button type="button" size="sm" variant="neutral" disabled={busy !== null} onClick={() => setPicked(null)}>Trocar jogo</Button>
            </div>
          ) : (
            <div className="grid gap-2">
              <label className="grid gap-2 text-sm font-bold">Nome do jogo
                <Input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} autoComplete="off" disabled={busy !== null} />
              </label>
              {results.length ? (
                <ul aria-label="Jogos encontrados" className="grid gap-2">
                  {results.map((result) => (
                    <li key={result.igdbId}>
                      <button type="button" onClick={() => setPicked({ igdbId: result.igdbId, name: result.name })}
                        className="hub-well flex w-full min-w-0 items-center gap-3 p-2 text-left">
                        <Cover game={result} small />
                        <span className="min-w-0">
                          <span className="block break-words font-bold">{result.name}</span>
                          <span className="hub-muted block break-words text-xs">{[result.releaseYear, result.platforms.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {searchNote ? <p className="hub-muted text-sm">{searchNote}</p> : null}
              {typed.length >= 2 ? (
                <button type="button" className="justify-self-start text-sm font-bold underline" onClick={() => setPicked({ name: typed })}>
                  Sugerir “{typed}” sem escolher da lista
                </button>
              ) : null}
            </div>
          )}
          <label className="grid gap-2 text-sm font-bold">Por que vale jogar? (opcional)
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} disabled={busy !== null} />
          </label>
          <div><Button type="submit" disabled={busy !== null || !picked}>{busy === "suggest" ? "Enviando…" : "Sugerir jogo"}</Button></div>
        </form>
      ) : (
        <p><a className="font-bold underline" href={signInHref}>Entre para sugerir jogos e votar</a></p>
      )}
      {message ? <p role={message.error ? "alert" : "status"} className="text-sm font-bold">{message.text}</p> : null}

      <section aria-labelledby="jogos-votacao" className="grid gap-6">
        <h2 id="jogos-votacao" className="text-3xl font-black">Em votação</h2>
        {!ranked.length ? <p>Nenhum jogo em votação ainda. Que tal sugerir o primeiro?</p> : (
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map((game) => (
              <GameCard key={game.id} game={game}>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                  <p className="text-sm font-bold">{votesLabel(game.votes)}</p>
                  {signedIn ? (
                    <Button type="button" size="sm" variant={game.voted ? "neutral" : "default"} aria-pressed={game.voted}
                      disabled={busy !== null} onClick={() => void vote(game)}>
                      <ThumbsUp className="size-4" aria-hidden="true" />
                      {game.voted ? "Votado" : "Votar"}
                    </Button>
                  ) : null}
                </div>
              </GameCard>
            ))}
          </ol>
        )}
      </section>

      {board.played.length ? (
        <section aria-labelledby="jogos-jogados" className="grid gap-6">
          <h2 id="jogos-jogados" className="text-3xl font-black">Já jogados</h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{board.played.map((game) => <GameCard key={game.id} game={game} />)}</ul>
        </section>
      ) : null}
    </div>
  );
}
