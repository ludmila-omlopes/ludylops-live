"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DurationInput } from "@/components/ui/duration-input";
import { Input } from "@/components/ui/input";
import { ownerItemClass, ownerPanelClass, ownerPanelTitleClass } from "@/components/ui/owner-panel";
import { formatDuration } from "@/lib/duration";
import { formatDateTime } from "@/lib/utils";
import type { PeriodicMessage, PeriodicSettingsView } from "@/lib/creators/periodic-messages";

export function PeriodicMessagesManager({ creatorId, defaultOpen = false }: { creatorId?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen), [busy, setBusy] = useState(false);
  const [data, setData] = useState<PeriodicSettingsView | null>(null);
  const [error, setError] = useState<string | null>(null), [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState(""), [interval, setInterval] = useState(300), [enabled, setEnabled] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
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
  function reset() { setEditing(null); setText(""); setInterval(300); setEnabled(false); setFormVersion((v) => v + 1); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!data) return;
    if (await request({ action: editing ? "update" : "create", ...(editing ? { id: editing } : {}), expectedRevision: data.revision,
      message: { text, intervalSeconds: interval, enabled } })) { reset(); setFeedback(enabled ? "Mensagem salva e ativada." : "Mensagem salva como pausada."); }
  }
  async function toggle(item: PeriodicMessage) {
    if (await request({ action: "update", id: item.id, expectedRevision: data!.revision,
      message: { text: item.text, intervalSeconds: item.intervalSeconds, enabled: !item.enabled } })) { reset(); setFeedback(item.enabled ? "Mensagem pausada." : "Mensagem ativada."); }
  }
  useEffect(() => {
    // Sections opened directly load their data once, like opening the toggle.
    if (defaultOpen) void request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <section className={defaultOpen ? ownerPanelClass : "mt-5 min-w-0 border-t-2 border-[var(--color-ink)] pt-4"}>
    <h2 className={defaultOpen ? ownerPanelTitleClass : "text-xl font-bold"}>Mensagens periódicas</h2>
    <p className="text-sm">Lembretes para o chat durante a live. Cada mensagem tem seu próprio intervalo.</p>
    {!defaultOpen && <Button type="button" variant="neutral" disabled={busy} className="mt-3" onClick={() => { setOpen(!open); if (!open) void request(); }}>{open ? "Fechar mensagens" : "Gerenciar mensagens periódicas"}</Button>}
    {open && <div className="grid min-w-0 gap-4">
      {error && <p role="alert" className="text-sm">{error}</p>}{feedback && <p role="status" className="text-sm">{feedback}</p>}
      {data && <>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p>Último contato do Streamer.bot: <strong>{data.lastContactAt ? formatDateTime(data.lastContactAt) : "ainda não registrado"}</strong>.</p>
          <Button type="button" variant="neutral" size="sm" disabled={busy} onClick={async () => { if (await request()) reset(); }}>Atualizar</Button>
        </div>
        <p className="text-sm">Configure a ação de mensagens periódicas no Streamer.bot. Mensagens novas começam pausadas; ativar ou editar reinicia o intervalo.{" "}
          <a className="font-bold underline" href="https://github.com/ludmila-omlopes/ludylops-live/blob/master/docs/periodic-chat-messages.md" target="_blank" rel="noreferrer">Como configurar no Streamer.bot</a></p>
        <form onSubmit={save} className="grid min-w-0 gap-4 border-[2px] border-[var(--color-ink)] p-4">
          <h3 className="font-black uppercase">{editing ? "Editar mensagem" : "Nova mensagem"}</h3>
          <label className="grid min-w-0 gap-2 text-sm font-bold">Mensagem<Input required maxLength={200} value={text} onChange={(event) => setText(event.target.value)} /></label>
          <div className="grid min-w-0 gap-2 text-sm font-bold">
            <label htmlFor={`${creatorId ?? "admin"}-periodic-interval`}>Intervalo</label>
            <DurationInput key={`${editing ?? "new"}-${formVersion}`} id={`${creatorId ?? "admin"}-periodic-interval`} seconds={interval} units={["minutes", "hours"]} onChange={setInterval} />
            <span className="font-medium text-[var(--color-ink-soft)]">Entre 1 minuto e 24 horas.</span>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />Ativar mensagem</label>
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || (!editing && data.items.length >= 20)}>{editing ? "Salvar mensagem" : "Adicionar mensagem"}</Button>
            {editing && <Button type="button" variant="neutral" onClick={reset}>Cancelar edição</Button>}</div>
        </form>
        {data.items.length === 0 && <p className="text-sm">Nenhuma mensagem cadastrada.</p>}
        {data.items.map((item) => <article key={item.id} className={ownerItemClass}>
          <p className="break-words font-bold">{item.text}</p><p>{item.enabled ? "Ativa" : "Pausada"} · a cada {formatDuration(item.intervalSeconds)}</p>
          <p>Última tentativa: {item.lastAttemptAt ? formatDateTime(item.lastAttemptAt) : "Ainda não registrada"}</p>
          <p>Último envio informado: {item.lastSentAt ? formatDateTime(item.lastSentAt) : "Ainda não registrado"}</p>
          {item.lastError && <p className="break-words">{item.lastError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="neutral" size="sm" disabled={busy} onClick={() => { setEditing(item.id); setText(item.text); setInterval(item.intervalSeconds); setEnabled(item.enabled); }}>Editar</Button>
            <Button type="button" variant="neutral" size="sm" disabled={busy} onClick={() => void toggle(item)}>{item.enabled ? "Pausar" : "Ativar"}</Button>
            <ConfirmButton size="sm" disabled={busy} confirmLabel="Confirmar remoção" onConfirm={async () => { if (await request({ action: "delete", id: item.id, expectedRevision: data.revision })) { reset(); setFeedback("Mensagem removida."); } }}>Remover</ConfirmButton>
          </div>
        </article>)}
      </>}
    </div>}
  </section>;
}
