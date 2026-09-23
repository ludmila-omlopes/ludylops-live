"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type History = { balance: { currentBalance: number }; entries: { id: string; amount: number; kind: string; reason: string; refundOf: string | null }[] };
export function CreatorEconomyManager({ creatorId, currencyLabel }: { creatorId: string; currencyLabel: string }) {
  const router = useRouter();
  const [channel, setChannel] = useState("");
  const [kind, setKind] = useState("credit");
  const [amount, setAmount] = useState("10");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<History | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Keep the same key after an uncertain response so retries cannot apply twice.
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  const endpoint = `/api/me/creator-area/${encodeURIComponent(creatorId)}/economy`;
  async function responseData(response: Response) {
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Não foi possível concluir agora.");
    return payload.data;
  }
  async function loadHistory() {
    const data = await responseData(await fetch(`${endpoint}?viewerExternalId=${encodeURIComponent(channel)}`, { cache: "no-store" }));
    setHistory(data);
  }
  async function lookup() {
    setBusy(true); setError(null); setSuccess(null); setHistory(null);
    try { await loadHistory(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível consultar o saldo."); }
    finally { setBusy(false); }
  }
  async function submit(refundOf?: string) {
    if (busy) return;
    setBusy(true); setError(null); setSuccess(null);
    const payload = { viewerExternalId: channel, kind: refundOf ? "refund" : kind,
      ...(refundOf ? { refundOf } : { amount: Number(amount) }), reason: refundOf ? "Estorno solicitado pelo streamer" : reason };
    const fingerprint = JSON.stringify(payload);
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, key: crypto.randomUUID() };
    try {
      await responseData(await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, operationKey: pending.current.key }) }));
      pending.current = null;
      setSuccess(refundOf ? "Débito estornado." : "Saldo atualizado.");
      await loadHistory(); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir agora. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <section className="grid gap-4 border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5">
    <h2 className="text-2xl font-black">Distribuir e ajustar {currencyLabel}</h2>
    <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <label className="grid gap-2 font-bold">ID do canal do YouTube
        <Input value={channel} required pattern="UC[A-Za-z0-9_-]{22}" placeholder="UC…" disabled={busy}
          onChange={(e) => { setChannel(e.target.value); setHistory(null); }} />
      </label>
      <Button type="button" variant="neutral" disabled={busy || !/^UC[A-Za-z0-9_-]{22}$/.test(channel)} onClick={() => void lookup()}>Consultar saldo</Button>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 font-bold">
          <label htmlFor={`economy-operation-${creatorId}`}>Operação</label>
          <select id={`economy-operation-${creatorId}`} className="border-2 border-[var(--color-ink)] bg-[var(--color-paper)] p-3" value={kind} disabled={busy} onChange={(e) => setKind(e.target.value)}>
            <option value="credit">Adicionar</option><option value="debit">Descontar</option>
          </select>
        </div>
        <label className="grid gap-2 font-bold">Quantidade de {currencyLabel}
          <Input type="number" min={1} max={1000000} step={1} required value={amount} disabled={busy} onChange={(e) => setAmount(e.target.value)} />
        </label>
      </div>
      <label className="grid gap-2 font-bold">Motivo
        <Input value={reason} required maxLength={160} disabled={busy} onChange={(e) => setReason(e.target.value)} />
      </label>
      <Button type="submit" disabled={busy}>{busy ? "Aguarde..." : "Aplicar ajuste"}</Button>
    </form>
    {error && <p role="alert">{error}</p>}
    {success && <p role="status">{success}</p>}
    {history && <div className="grid gap-3">
      <h3 className="text-xl font-bold">Saldo: {history.balance.currentBalance.toLocaleString("pt-BR")} {currencyLabel}</h3>
      {history.entries.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-ink)] py-3">
        <span>{entry.amount > 0 ? "+" : ""}{entry.amount.toLocaleString("pt-BR")} {currencyLabel} · {entry.reason}</span>
        {entry.kind === "debit" && !history.entries.some((e) => e.refundOf === entry.id) && <Button type="button" variant="neutral" disabled={busy} onClick={() => void submit(entry.id)}>Estornar</Button>}
      </div>)}
      {!history.entries.length && <p>Nenhuma movimentação ainda.</p>}
    </div>}
  </section>;
}
