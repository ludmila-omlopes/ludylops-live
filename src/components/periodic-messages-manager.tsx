"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import type { PeriodicMessage, PeriodicSettingsView } from "@/lib/creators/periodic-messages";

export function PeriodicMessagesManager({ creatorId }: { creatorId?: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [data, setData] = useState<PeriodicSettingsView | null>(null);
  const [error, setError] = useState<string | null>(null), [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState(""), [interval, setInterval] = useState(300), [enabled, setEnabled] = useState(false);
  const endpoint = creatorId ? `/api/me/creator-area/${encodeURIComponent(creatorId)}/periodic-messages` : "/api/admin/periodic-messages";
  async function request(input?: unknown) {
    setBusy(true); setError(null); setFeedback("");
    try {
      const response = await fetch(endpoint, input ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) } : { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw Error(result.error || "Não foi possível salvar a mensagem.");
      setData(result.data); return true;
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível acessar as mensagens."); return false; }
    finally { setBusy(false); }
  }
  function reset() { setEditing(null); setText(""); setInterval(300); setEnabled(false); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!data) return;
    if (await request({ action: editing ? "update" : "create", ...(editing ? { id: editing } : {}), expectedRevision: data.revision,
      message: { text, intervalSeconds: interval, enabled } })) { reset(); setFeedback(enabled ? "Mensagem salva e ativada." : "Mensagem salva como pausada."); }
  }
  async function toggle(item: PeriodicMessage) {
    if (await request({ action: "update", id: item.id, expectedRevision: data!.revision,
      message: { text: item.text, intervalSeconds: item.intervalSeconds, enabled: !item.enabled } })) { reset(); setFeedback(item.enabled ? "Mensagem pausada." : "Mensagem ativada."); }
  }
  return <section className="mt-5 min-w-0 border-t-2 border-[var(--color-ink)] pt-4">
    <h3 className="text-xl font-bold">Mensagens periódicas</h3>
    <p className="mt-2 text-sm">Lembretes para o chat durante a live. Cada mensagem tem seu próprio intervalo.</p>
    <Button type="button" variant="neutral" disabled={busy} className="mt-3" onClick={() => { setOpen(!open); if (!open) void request(); }}>{open ? "Fechar mensagens" : "Gerenciar mensagens periódicas"}</Button>
    {open && <div className="mt-4 grid min-w-0 gap-4">
      {error && <p role="alert">{error}</p>}{feedback && <p role="status">{feedback}</p>}
      <Button type="button" variant="neutral" disabled={busy} onClick={async () => { if (await request()) reset(); }}>Atualizar mensagens</Button>
      {data && <>
        <p className="text-sm">Último contato do Streamer.bot: {data.lastContactAt ? formatDateTime(data.lastContactAt) : "Ainda não registrado"}.</p>
        <p className="text-sm">Configure a ação de mensagens periódicas no Streamer.bot. Mensagens novas começam pausadas; ativar ou editar reinicia o intervalo.</p>
        <a className="font-bold underline" href="https://github.com/ludmila-omlopes/ludylops-live/blob/master/docs/periodic-chat-messages.md" target="_blank" rel="noreferrer">Configurar mensagens no Streamer.bot</a>
        <form onSubmit={save} className="grid gap-3 border-2 border-[var(--color-ink)] p-3">
          <label className="grid gap-1 text-sm font-bold">Mensagem<input required maxLength={200} value={text} onChange={(event) => setText(event.target.value)} className="min-w-0 border bg-[var(--color-paper)] p-2" /></label>
          <label className="grid gap-1 text-sm font-bold">Intervalo em segundos<input required type="number" min={60} max={86400} value={interval} onChange={(event) => setInterval(event.target.valueAsNumber)} className="min-w-0 border bg-[var(--color-paper)] p-2" /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />Ativar mensagem</label>
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || (!editing && data.items.length >= 20)}>{editing ? "Salvar mensagem" : "Adicionar mensagem"}</Button>
            {editing && <Button type="button" variant="neutral" onClick={reset}>Cancelar edição</Button>}</div>
        </form>
        {data.items.length === 0 && <p>Nenhuma mensagem cadastrada.</p>}
        {data.items.map((item) => <article key={item.id} className="grid min-w-0 gap-2 border-2 border-[var(--color-ink)] p-3 text-sm">
          <p className="break-words font-bold">{item.text}</p><p>{item.enabled ? "Ativa" : "Pausada"} · a cada {item.intervalSeconds} segundos</p>
          <p>Última tentativa: {item.lastAttemptAt ? formatDateTime(item.lastAttemptAt) : "Ainda não registrada"}</p>
          <p>Último envio informado: {item.lastSentAt ? formatDateTime(item.lastSentAt) : "Ainda não registrado"}</p>
          {item.lastError && <p className="break-words">{item.lastError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="neutral" disabled={busy} onClick={() => { setEditing(item.id); setText(item.text); setInterval(item.intervalSeconds); setEnabled(item.enabled); }}>Editar mensagem</Button>
            <Button type="button" variant="neutral" disabled={busy} onClick={() => void toggle(item)}>{item.enabled ? "Pausar" : "Ativar"}</Button>
            <Button type="button" variant="danger" disabled={busy} onClick={async () => { if (await request({ action: "delete", id: item.id, expectedRevision: data.revision })) { reset(); setFeedback("Mensagem removida."); } }}>Remover</Button>
          </div>
        </article>)}
      </>}
    </div>}
  </section>;
}
