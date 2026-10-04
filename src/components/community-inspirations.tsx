"use client";

import { useState } from "react";
import { ExternalLink, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { inspirationLinkLabels, type CommunityInspiration, type CommunityInspirationBoard } from "@/lib/creators/inspirations";

const cardClass = "hub-card flex min-w-0 flex-col gap-4 border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5";
const votesLabel = (votes: number) => (votes === 1 ? "1 voto" : `${votes.toLocaleString("pt-BR")} votos`);

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível falar com a comunidade agora.");
  return payload.data as CommunityInspiration;
}

/** Audience suggestions are user-generated links; the creator's own picks are endorsed. */
function ChannelLink({ inspiration, endorsed }: { inspiration: CommunityInspiration; endorsed: boolean }) {
  return (
    <a href={inspiration.channelUrl} target="_blank" rel={endorsed ? "noopener noreferrer" : "noopener noreferrer nofollow ugc"}
      className="inline-flex items-center gap-1 text-sm font-bold underline">
      {inspirationLinkLabels[inspiration.platform]}
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}

export function CommunityInspirations({ slug, displayName, board, signedIn, signInHref }: {
  slug: string;
  displayName: string;
  board: CommunityInspirationBoard;
  signedIn: boolean;
  signInHref: string;
}) {
  const [open, setOpen] = useState(board.open);
  const [draft, setDraft] = useState({ name: "", channelUrl: "", reason: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const base = `/api/c/${encodeURIComponent(slug)}/inspirations`;

  async function suggest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("suggest"); setMessage(null);
    try {
      const created = await send(base, "POST", { name: draft.name, channelUrl: draft.channelUrl, reason: draft.reason || undefined });
      setOpen((current) => [...current, created]);
      setDraft({ name: "", channelUrl: "", reason: "" });
      setMessage({ text: "Indicação enviada. Seu voto já conta.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Não foi possível enviar a indicação.", error: true });
    } finally { setBusy(null); }
  }

  async function vote(inspiration: CommunityInspiration) {
    setBusy(inspiration.id); setMessage(null);
    try {
      const updated = await send(`${base}/${encodeURIComponent(inspiration.id)}/vote`, inspiration.voted ? "DELETE" : "POST");
      setOpen((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Não foi possível registrar seu voto.", error: true });
    } finally { setBusy(null); }
  }

  const ranked = [...open].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="grid gap-10">
      {board.featured.length ? (
        <section aria-labelledby="inspiracoes-destaque" className="grid gap-6">
          <h2 id="inspiracoes-destaque" className="text-3xl font-black">Em destaque</h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {board.featured.map((inspiration) => (
              <li key={inspiration.id} className={cardClass}>
                <div className="grid min-w-0 gap-1">
                  <h3 className="break-words text-xl font-black">{inspiration.name}</h3>
                  <p className="hub-muted text-sm">Recomendado por {displayName}</p>
                </div>
                {inspiration.reason ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{inspiration.reason}</p> : null}
                <div className="mt-auto pt-2"><ChannelLink inspiration={inspiration} endorsed /></div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {signedIn ? (
        <form onSubmit={suggest} className={`${cardClass} max-w-2xl`}>
          <h2 className="text-2xl font-black">Indicar um criador</h2>
          <label className="grid gap-2 text-sm font-bold">Nome do criador
            <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              required minLength={2} maxLength={120} disabled={busy !== null} />
          </label>
          <label className="grid gap-2 text-sm font-bold">Link do canal
            <Input value={draft.channelUrl} onChange={(event) => setDraft((current) => ({ ...current, channelUrl: event.target.value }))}
              required maxLength={500} inputMode="url" placeholder="https://www.youtube.com/@…" disabled={busy !== null} />
          </label>
          <label className="grid gap-2 text-sm font-bold">Por que vale conhecer? (opcional)
            <Textarea value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))}
              maxLength={500} rows={3} disabled={busy !== null} />
          </label>
          <div><Button type="submit" disabled={busy !== null}>{busy === "suggest" ? "Enviando…" : "Indicar criador"}</Button></div>
        </form>
      ) : (
        <p><a className="font-bold underline" href={signInHref}>Entre para indicar criadores e votar</a></p>
      )}
      {message ? <p role={message.error ? "alert" : "status"} className="text-sm font-bold">{message.text}</p> : null}

      <section aria-labelledby="inspiracoes-votacao" className="grid gap-6">
        <h2 id="inspiracoes-votacao" className="text-3xl font-black">Indicados pela comunidade</h2>
        {!ranked.length ? <p>Nenhuma indicação em votação ainda. Que tal indicar o primeiro criador?</p> : (
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map((inspiration) => (
              <li key={inspiration.id} className={cardClass}>
                <div className="grid min-w-0 gap-1">
                  <h3 className="break-words text-xl font-black">{inspiration.name}</h3>
                  <p className="hub-muted break-words text-sm">Indicado por {inspiration.suggestedBy}</p>
                </div>
                {inspiration.reason ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{inspiration.reason}</p> : null}
                <ChannelLink inspiration={inspiration} endorsed={false} />
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                  <p className="text-sm font-bold">{votesLabel(inspiration.votes)}</p>
                  {signedIn ? (
                    <Button type="button" size="sm" variant={inspiration.voted ? "neutral" : "default"} aria-pressed={inspiration.voted}
                      disabled={busy !== null} onClick={() => void vote(inspiration)}>
                      <ThumbsUp className="size-4" aria-hidden="true" />
                      {inspiration.voted ? "Votado" : "Votar"}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
