"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ownerLabelClass } from "@/components/ui/owner-panel";
import {
  inspirationPlatformLabels,
  type CommunityInspiration,
  type CommunityInspirationBoard,
  type CommunityInspirationStatus,
} from "@/lib/creators/inspirations";

const votesLabel = (votes: number) => (votes === 1 ? "1 voto" : `${votes.toLocaleString("pt-BR")} votos`);

const actions: Record<CommunityInspirationStatus, { status: CommunityInspirationStatus; label: string; variant: "default" | "neutral" }[]> = {
  open: [{ status: "featured", label: "Destacar", variant: "default" }, { status: "rejected", label: "Recusar", variant: "neutral" }],
  featured: [{ status: "open", label: "Tirar do destaque", variant: "neutral" }],
  rejected: [{ status: "open", label: "Voltar para a votação", variant: "neutral" }],
};

const groups: { status: CommunityInspirationStatus; title: string; empty: string }[] = [
  { status: "featured", title: "Em destaque", empty: "Nenhum criador em destaque. Destaque uma indicação ou adicione quem você recomenda." },
  { status: "open", title: "Indicados pelo público", empty: "Nenhuma indicação em votação. Conte ao seu público que ele pode indicar criadores." },
  { status: "rejected", title: "Recusados", empty: "Nenhuma indicação recusada." },
];

const sortBoard = (board: CommunityInspirationBoard): CommunityInspirationBoard =>
  ({ ...board, open: [...board.open].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt)) });

const emptyDraft = { name: "", channelUrl: "", reason: "" };

export function CommunityInspirationsManager({ creatorId, initial }: { creatorId: string; initial: CommunityInspirationBoard }) {
  const [board, setBoard] = useState(() => sortBoard(initial));
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const endpoint = `/api/me/creator-area/${encodeURIComponent(creatorId)}/inspirations`;

  async function request(method: "POST" | "PATCH", body: unknown) {
    const response = await fetch(endpoint, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível salvar.");
    return payload.data as CommunityInspiration;
  }

  function place(updated: CommunityInspiration) {
    setBoard((current) => {
      const without = (list: CommunityInspiration[]) => list.filter((entry) => entry.id !== updated.id);
      const next = { featured: without(current.featured), open: without(current.open), rejected: without(current.rejected) };
      next[updated.status] = [updated, ...next[updated.status]];
      return sortBoard(next);
    });
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("add"); setMessage(null);
    try {
      place(await request("POST", { name: draft.name, channelUrl: draft.channelUrl, reason: draft.reason || undefined }));
      setDraft(emptyDraft);
      setMessage({ text: "Criador adicionado ao destaque.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Não foi possível adicionar o criador.", error: true });
    } finally { setBusy(null); }
  }

  async function move(inspiration: CommunityInspiration, status: CommunityInspirationStatus) {
    setBusy(inspiration.id); setMessage(null);
    try {
      place(await request("PATCH", { suggestionId: inspiration.id, status }));
      setMessage({ text: status === "featured" ? "Criador em destaque." : status === "rejected" ? "Indicação recusada." : "Indicação de volta à votação.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Não foi possível atualizar a indicação.", error: true });
    } finally { setBusy(null); }
  }

  return (
    <div className="grid gap-8">
      <form onSubmit={add} className="hub-card grid gap-4 p-6">
        <h2 className="hub-h2">Recomendar um criador</h2>
        <fieldset disabled={busy !== null} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className={ownerLabelClass}>Nome do criador
            <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required minLength={2} maxLength={120} />
          </label>
          <label className={ownerLabelClass}>Link do canal
            <Input value={draft.channelUrl} onChange={(event) => setDraft((current) => ({ ...current, channelUrl: event.target.value }))}
              required maxLength={500} inputMode="url" placeholder="https://www.youtube.com/@…" />
          </label>
          <label className={`${ownerLabelClass} sm:col-span-2`}>Por que você recomenda? (opcional)
            <Textarea value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} maxLength={500} rows={3} />
          </label>
        </fieldset>
        <div><Button type="submit" disabled={busy !== null}>{busy === "add" ? "Salvando…" : "Adicionar ao destaque"}</Button></div>
      </form>

      {message ? <p role={message.error ? "alert" : "status"} className="text-sm">{message.text}</p> : null}

      {groups.map((group) => (
        <section key={group.status} aria-labelledby={`inspiracoes-${group.status}`} className="hub-card grid gap-4 p-6">
          <h2 id={`inspiracoes-${group.status}`} className="hub-h2">{group.title}</h2>
          {!board[group.status].length ? <p className="hub-muted text-sm">{group.empty}</p> : (
            <ol className="grid gap-3">
              {board[group.status].map((inspiration) => (
                <li key={inspiration.id} className="hub-well grid min-w-0 gap-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 break-words font-semibold">{inspiration.name}</h3>
                    {inspiration.status === "featured" ? null : <span className="hub-chip">{votesLabel(inspiration.votes)}</span>}
                  </div>
                  <p className="hub-muted break-words text-sm">{inspirationPlatformLabels[inspiration.platform]} · indicado por {inspiration.suggestedBy}</p>
                  {inspiration.reason ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{inspiration.reason}</p> : null}
                  <a href={inspiration.channelUrl} target="_blank" rel="noopener noreferrer nofollow" className="hub-link justify-self-start break-all text-sm">
                    {inspiration.channelUrl.replace(/^https:\/\//u, "")}
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                  </a>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {actions[inspiration.status].map((action) => (
                      <Button key={action.status} type="button" size="sm" variant={action.variant} disabled={busy !== null}
                        onClick={() => void move(inspiration, action.status)}>
                        {action.label}
                      </Button>
                    ))}
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
