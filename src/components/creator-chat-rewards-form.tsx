"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chatRewardSettingsSchema, defaultChatRewards } from "@/lib/creators/chat-rewards";

export function CreatorChatRewardsForm({ creatorId }: { creatorId: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState(String(defaultChatRewards.amount));
  const [cooldown, setCooldown] = useState(String(defaultChatRewards.cooldownSeconds));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const endpoint = `/api/me/creator-area/${encodeURIComponent(creatorId)}/chat-rewards`;
  async function receive(response: Response) {
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Não foi possível salvar os ganhos por mensagem.");
    const settings = chatRewardSettingsSchema.parse(payload.data);
    setEnabled(settings.enabled); setAmount(String(settings.amount)); setCooldown(String(settings.cooldownSeconds));
  }
  async function load() {
    setOpen(true); setLoaded(false); setBusy(true); setError(null); setSaved(false);
    try { await receive(await fetch(endpoint, { cache: "no-store" })); setLoaded(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível consultar os ganhos."); }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setSaved(false);
    const parsed = chatRewardSettingsSchema.safeParse({ enabled, amount: Number(amount), cooldownSeconds: Number(cooldown) });
    if (!parsed.success) { setError("Use de 1 a 10.000 por mensagem e um intervalo de 10 a 86.400 segundos."); return; }
    setBusy(true);
    try {
      await receive(await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) }));
      setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar os ganhos."); }
    finally { setBusy(false); }
  }
  return <div className="mt-3">
    <Button type="button" variant="neutral" disabled={busy} aria-expanded={open} onClick={() => open ? setOpen(false) : void load()}>
      {open ? "Fechar ganhos no chat" : "Configurar ganhos no chat"}
    </Button>
    {open && <form onSubmit={save} className="mt-3 grid gap-4 border-2 border-[var(--color-ink)] p-4">
      <h2 className="text-xl font-bold">Ganhos por mensagem</h2>
      <p className="text-sm">Cada espectador ganha sua moeda ao conversar no chat do YouTube, respeitando o intervalo entre ganhos. Canais vinculados à mesma conta compartilham esse intervalo.</p>
      <fieldset disabled={busy || !loaded} className="grid min-w-0 gap-4">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setSaved(false); }} />
          Ativar ganhos por mensagem
        </label>
        <label className="grid gap-2 text-sm font-bold">Unidades da moeda por mensagem
          <Input type="number" min={1} max={10000} step={1} required value={amount} onChange={(e) => { setAmount(e.target.value); setSaved(false); }} />
        </label>
        <label className="grid gap-2 text-sm font-bold">Intervalo mínimo por espectador (segundos)
          <Input type="number" min={10} max={86400} step={1} required value={cooldown} onChange={(e) => { setCooldown(e.target.value); setSaved(false); }} />
        </label>
      </fieldset>
      <p className="text-sm">É necessário conectar a ação de ganhos por mensagem no Streamer.bot. Pausar os ganhos preserva tudo que a comunidade já acumulou.</p>
      {error && <p role="alert" className="text-sm">{error}</p>}
      {saved && <p role="status" className="text-sm">{enabled ? "Regra salva. Os ganhos dependem da integração e da moeda estarem ativas." : "Ganhos por mensagem pausados. Os saldos foram preservados."}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !loaded}>{busy ? "Aguarde..." : "Salvar ganhos no chat"}</Button>
        {!loaded && !busy && <Button type="button" variant="neutral" onClick={() => void load()}>Tentar novamente</Button>}
      </div>
    </form>}
  </div>;
}
