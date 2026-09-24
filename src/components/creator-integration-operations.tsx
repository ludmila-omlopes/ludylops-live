"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import type { IntegrationOperations } from "@/lib/creators/integration-operations";

export function CreatorIntegrationOperations({ creatorId }: { creatorId: string }) {
  const [data, setData] = useState<IntegrationOperations | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [selected, setSelected] = useState<IntegrationOperations["pending"][number] | null>(null);
  const [outcome, setOutcome] = useState(""), [note, setNote] = useState(""), [stopped, setStopped] = useState(false), [checked, setChecked] = useState(false);
  const router = useRouter(), endpoint = `/api/me/creator-area/${encodeURIComponent(creatorId)}/integration-operations`;
  async function result(response: Response) { const body = await response.json(); if (!response.ok || !body.ok) throw Error(body.error ?? "Não foi possível consultar os resgates."); return body.data; }
  async function load() { setData(null); setData(await result(await fetch(endpoint, { cache: "no-store" }))); }
  async function refresh() {
    setBusy(true); setError(""); setMessage(""); setSelected(null);
    try { await load(); } catch (e) { setError(e instanceof Error ? e.message : "Consulta indisponível."); } finally { setBusy(false); }
  }
  return <section className="panel grid min-w-0 gap-4 p-4 sm:p-6">
    <h2 className="text-2xl font-bold">Integração e resgates pendentes</h2>
    <Button className="min-w-0 max-w-full whitespace-normal break-words" variant="neutral" disabled={busy} onClick={() => void refresh()}>{busy ? "Aguarde…" : "Consultar integração e pendências"}</Button>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {data && <>
      <p className="text-sm">Consulta de {formatDateTime(data.checkedAt)}. Atividade recente significa uma mensagem do bridge nos 90 segundos anteriores à consulta; não comprova conexão atual, resposta do Streamer.bot ou efeito na live. Atualize para conferir novamente.</p>
      {!data.bridges.length && <p>Nenhum sinal do bridge registrado. Confira se ele está em execução com a credencial desta comunidade.</p>}
      <ul className="grid gap-2">{data.bridges.map(b => <li key={b.bridgeId} className="break-words border-b pb-2"><strong className="break-all">{b.bridgeId}</strong>: {b.recent ? "Atividade recente" : "Sem atividade recente"} · {formatDateTime(b.lastHeartbeatAt)}</li>)}</ul>
      <p className="text-sm">Até 100 resgates pendentes, dos mais antigos aos mais novos. Na fila: aguarda ser assumido. Em execução: já foi assumido, mas o resultado ainda não foi confirmado. Não repita a action quando o resultado for incerto.</p>
      {!data.pending.length && <p>Nenhum resgate pendente.</p>}
      <ul className="grid gap-3">{data.pending.map(r => <li key={r.id} className="grid min-w-0 gap-2 border-2 border-[var(--color-ink)] p-3">
        <h3 className="break-words font-bold">{r.itemName} · {r.cost} {data.currencyLabel}</h3><code className="break-all text-xs">{r.id}</code>
        <p>{r.status === "queued" ? "Na fila" : "Em execução"} desde {formatDateTime(r.claimedAt ?? r.queuedAt)}.</p>
        {r.bridgeId && <p className="break-all">Bridge responsável: {r.bridgeId}</p>}
        {r.status === "executing" && <Button className="min-w-0 max-w-full whitespace-normal break-words" variant="neutral" disabled={busy} onClick={() => { setSelected(r); setOutcome(""); setNote(""); setStopped(false); setChecked(false); setError(""); setMessage(""); }}>Resolver {r.itemName}</Button>}
      </li>)}</ul>
      {selected && <form className="grid min-w-0 gap-4 border-2 border-[var(--color-ink)] p-4" onSubmit={event => { event.preventDefault(); if (!stopped || !checked || !outcome) return; setBusy(true); setError(""); setMessage(""); void (async () => {
        try {
          await result(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ redemptionId: selected.id, expectedStatus: "executing", outcome, note, bridgeStopped: stopped, resultChecked: checked }) }));
          setSelected(null); setMessage("Resolução registrada. A action não foi executada novamente."); router.refresh(); await load();
        } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível confirmar. Tente novamente com os mesmos dados."); }
        finally { setBusy(false); }
      })(); }}>
        <h3 className="break-words text-xl font-bold">Resolver {selected.itemName}</h3>
        <code className="break-all text-xs">{selected.id}</code>
        <p>Pare todas as instâncias do bridge desta comunidade e aguarde qualquer action em andamento terminar. Confira o resultado no Streamer.bot e na transmissão antes de decidir.</p>
        <label className="flex items-start gap-2"><input type="checkbox" required disabled={busy} checked={stopped} onChange={e => setStopped(e.target.checked)} />Parei os bridges e não há action em andamento.</label>
        <label className="flex items-start gap-2"><input type="checkbox" required disabled={busy} checked={checked} onChange={e => setChecked(e.target.checked)} />Conferi o resultado deste resgate no Streamer.bot e na live.</label>
        <label className="grid gap-1">Resultado observado<select className="w-full min-w-0 border-2 p-2" required disabled={busy} value={outcome} onChange={e => setOutcome(e.target.value)}><option value="">Selecione o resultado</option><option value="completed">Executou: registrar conclusão</option><option value="failed">Falhou: devolver a moeda</option></select></label>
        <label className="grid gap-1">O que você verificou?<textarea className="w-full min-w-0 border-2 p-2" minLength={5} maxLength={255} required disabled={busy} value={note} onChange={e => setNote(e.target.value)} /></label>
        <p className="text-sm">A falha devolve {selected.cost} {data.currencyLabel} uma única vez. O estoque não é reposto automaticamente. O resultado fica registrado com sua identificação e não pode ser trocado por este fluxo.</p>
        <div className="flex flex-wrap gap-2"><Button className="min-w-0 max-w-full whitespace-normal break-words" type="submit" disabled={busy || !stopped || !checked || !outcome || note.trim().length < 5}>Registrar resolução</Button><Button className="min-w-0 max-w-full whitespace-normal break-words" variant="neutral" disabled={busy} onClick={() => setSelected(null)}>Cancelar resolução</Button></div>
      </form>}
      <h3 className="text-lg font-bold">Últimas resoluções manuais</h3>
      {!data.resolutions.length && <p>Nenhuma resolução manual registrada.</p>}
      <ul className="grid gap-3 text-sm">{data.resolutions.map(r => <li key={r.redemptionId} className="grid gap-1 border-t pt-2"><code className="break-all">{r.redemptionId}</code><p>{r.outcome === "completed" ? "Conclusão confirmada" : "Falha com estorno"} · {formatDateTime(r.createdAt)}</p><p className="break-words">{r.note}</p><p className="break-all">Responsável: {r.ownerViewerId}</p></li>)}</ul>
    </>}
  </section>;
}
