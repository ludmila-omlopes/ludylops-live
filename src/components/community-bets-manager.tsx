"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ownerFieldClass, ownerLabelClass } from "@/components/ui/owner-panel";
import type { CommunityBet, CommunityBetBoard } from "@/lib/creators/bets";

const durations = [
  { minutes: 30, label: "30 minutos" }, { minutes: 60, label: "1 hora" }, { minutes: 180, label: "3 horas" },
  { minutes: 1440, label: "1 dia" }, { minutes: 4320, label: "3 dias" }, { minutes: 10080, label: "7 dias" },
];
const formatTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const emptyDraft = { question: "", options: ["", ""], closesInMinutes: 1440 };

function BetSummary({ bet }: { bet: CommunityBet }) {
  return (
    <ul className="grid gap-1 text-sm">
      {bet.options.map((option) => (
        <li key={option.id} className="flex flex-wrap justify-between gap-2">
          <span className="min-w-0 break-words">{option.label}{bet.winningOptionId === option.id ? " · vencedora" : ""}</span>
          <span className="hub-muted">{option.pool.toLocaleString("pt-BR")}</span>
        </li>
      ))}
    </ul>
  );
}

export function CommunityBetsManager({ creatorId, initial }: { creatorId: string; initial: CommunityBetBoard }) {
  const [board, setBoard] = useState(initial);
  const [draft, setDraft] = useState(emptyDraft);
  const [winners, setWinners] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const endpoint = `/api/me/creator-area/${encodeURIComponent(creatorId)}/bets`;

  async function request(method: "POST" | "PATCH", body: unknown) {
    const response = await fetch(endpoint, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível salvar a aposta.");
    return payload.data as CommunityBet;
  }

  function place(bet: CommunityBet) {
    setBoard((current) => {
      const active = current.active.filter((entry) => entry.id !== bet.id);
      const finished = current.finished.filter((entry) => entry.id !== bet.id);
      return bet.status === "open" || bet.status === "locked"
        ? { ...current, active: [bet, ...active], finished }
        : { ...current, active, finished: [bet, ...finished] };
    });
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create"); setMessage(null);
    try {
      place(await request("POST", { question: draft.question, options: draft.options, closesInMinutes: draft.closesInMinutes }));
      setDraft(emptyDraft);
      setMessage({ text: "Aposta aberta.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Não foi possível abrir a aposta.", error: true });
    } finally { setBusy(null); }
  }

  async function act(bet: CommunityBet, body: Record<string, string>, done: string, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(bet.id); setMessage(null);
    try {
      place(await request("PATCH", { betId: bet.id, ...body }));
      setMessage({ text: done, error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Não foi possível atualizar a aposta.", error: true });
    } finally { setBusy(null); }
  }

  return (
    <div className="grid gap-8">
      <form onSubmit={create} className="hub-card grid gap-4 p-6">
        <h2 className="hub-h2">Abrir uma aposta</h2>
        <fieldset disabled={busy !== null} className="grid min-w-0 gap-4">
          <label className={ownerLabelClass}>Pergunta
            <Input value={draft.question} onChange={(e) => setDraft((current) => ({ ...current, question: e.target.value }))} required minLength={5} maxLength={200}
              placeholder="Quem vence o próximo chefe?" />
          </label>
          <div className="grid gap-2">
            <p className="text-sm font-bold">Opções</p>
            {draft.options.map((option, index) => (
              <div key={index} className="flex min-w-0 gap-2">
                <Input aria-label={`Opção ${index + 1}`} value={option} required maxLength={80}
                  onChange={(e) => setDraft((current) => ({ ...current, options: current.options.map((value, i) => (i === index ? e.target.value : value)) }))} />
                {draft.options.length > 2 ? (
                  <Button type="button" size="sm" variant="neutral" aria-label={`Remover opção ${index + 1}`}
                    onClick={() => setDraft((current) => ({ ...current, options: current.options.filter((_, i) => i !== index) }))}>
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            ))}
            {draft.options.length < 6 ? (
              <div><Button type="button" size="sm" variant="neutral" onClick={() => setDraft((current) => ({ ...current, options: [...current.options, ""] }))}>
                <Plus className="size-4" aria-hidden="true" />Adicionar opção
              </Button></div>
            ) : null}
          </div>
          <label className={ownerLabelClass}>Aceitar apostas por
            <select className={ownerFieldClass} value={draft.closesInMinutes} onChange={(e) => setDraft((current) => ({ ...current, closesInMinutes: Number(e.target.value) }))}>
              {durations.map((duration) => <option key={duration.minutes} value={duration.minutes}>{duration.label}</option>)}
            </select>
          </label>
        </fieldset>
        <p className="hub-muted text-sm">Quem acertar divide o pote inteiro, na proporção do que apostou. Se ninguém acertar, todas as apostas são devolvidas. A aposta mínima é {board.minBet.toLocaleString("pt-BR")}.</p>
        <div><Button type="submit" disabled={busy !== null}>{busy === "create" ? "Abrindo…" : "Abrir aposta"}</Button></div>
      </form>

      {message ? <p role={message.error ? "alert" : "status"} className="text-sm">{message.text}</p> : null}

      <section aria-labelledby="apostas-ativas" className="hub-card grid gap-4 p-6">
        <h2 id="apostas-ativas" className="hub-h2">Em andamento</h2>
        {!board.active.length ? <p className="hub-muted text-sm">Nenhuma aposta em andamento.</p> : (
          <ol className="grid gap-3">
            {board.active.map((bet) => (
              <li key={bet.id} className="hub-well grid min-w-0 gap-3 p-4">
                <div className="grid gap-1">
                  <h3 className="break-words font-semibold">{bet.question}</h3>
                  <p className="hub-muted text-sm">
                    {bet.status === "locked" ? "Apostas encerradas" : bet.acceptingEntries ? `Aceita apostas até ${formatTime(bet.closesAt)}` : `Prazo terminou em ${formatTime(bet.closesAt)}`}
                    {" · "}{bet.totalPool.toLocaleString("pt-BR")} no pote · {bet.entryCount} {bet.entryCount === 1 ? "aposta" : "apostas"}
                  </p>
                </div>
                <BetSummary bet={bet} />
                <div className="flex flex-wrap items-end gap-2">
                  {bet.status === "open" ? (
                    <Button type="button" size="sm" variant="neutral" disabled={busy !== null} onClick={() => void act(bet, { action: "lock" }, "Apostas encerradas.")}>Encerrar apostas</Button>
                  ) : null}
                  <label className="grid gap-1 text-sm font-bold">Resultado
                    <select className={ownerFieldClass} value={winners[bet.id] ?? ""} onChange={(e) => setWinners((current) => ({ ...current, [bet.id]: e.target.value }))}>
                      <option value="">Escolha a opção vencedora</option>
                      {bet.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  </label>
                  <Button type="button" size="sm" disabled={busy !== null || !winners[bet.id]}
                    onClick={() => void act(bet, { action: "resolve", winningOptionId: winners[bet.id] }, "Resultado definido e prêmios pagos.",
                      "Definir o resultado paga os prêmios e não pode ser desfeito. Continuar?")}>Definir resultado</Button>
                  <Button type="button" size="sm" variant="neutral" disabled={busy !== null}
                    onClick={() => void act(bet, { action: "cancel" }, "Aposta cancelada e valores devolvidos.", "Cancelar devolve todas as apostas. Continuar?")}>Cancelar e devolver</Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="apostas-decididas" className="hub-card grid gap-4 p-6">
        <h2 id="apostas-decididas" className="hub-h2">Decididas</h2>
        {!board.finished.length ? <p className="hub-muted text-sm">Nenhuma aposta decidida ainda.</p> : (
          <ol className="grid gap-3">
            {board.finished.map((bet) => (
              <li key={bet.id} className="hub-well grid min-w-0 gap-2 p-4">
                <h3 className="break-words font-semibold">{bet.question}</h3>
                <p className="hub-muted text-sm">
                  {bet.status === "cancelled" ? "Cancelada; valores devolvidos." : bet.refunded ? "Ninguém acertou; valores devolvidos." : `Vencedora: ${bet.options.find((option) => option.id === bet.winningOptionId)?.label ?? ""}`}
                  {" · "}{bet.totalPool.toLocaleString("pt-BR")} no pote
                </p>
                <BetSummary bet={bet} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
