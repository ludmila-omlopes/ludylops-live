"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ownerPanelClass, ownerPanelTitleClass } from "@/components/ui/owner-panel";
import { pageRewardSettingsSchema, type PageRewardSettings } from "@/lib/creators/page-rewards";

/** The owner's daily visit and picked-suggestion rewards. Loaded on the server; a failed load shows the retry message. */
export function CreatorPageRewardsForm({ creatorId, initial, currencyLabel }: { creatorId: string; initial?: PageRewardSettings; currencyLabel: string }) {
  const [settings, setSettings] = useState(initial);
  const [draft, setDraft] = useState(() => ({
    presenceEnabled: initial?.presenceEnabled ?? false, presenceAmount: String(initial?.presenceAmount ?? 10),
    suggestionBonusEnabled: initial?.suggestionBonusEnabled ?? false, suggestionBonusAmount: String(initial?.suggestionBonusAmount ?? 50),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const endpoint = `/api/me/creator-area/${encodeURIComponent(creatorId)}/page-rewards`;

  function change(next: Partial<typeof draft>) { setDraft((current) => ({ ...current, ...next })); setSaved(false); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setSaved(false);
    const parsed = pageRewardSettingsSchema.safeParse({
      presenceEnabled: draft.presenceEnabled, presenceAmount: Number(draft.presenceAmount),
      suggestionBonusEnabled: draft.suggestionBonusEnabled, suggestionBonusAmount: Number(draft.suggestionBonusAmount),
    });
    if (!parsed.success) { setError("Use valores inteiros de 1 a 10.000."); return; }
    setBusy(true);
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível salvar os ganhos na página.");
      setSettings(pageRewardSettingsSchema.parse(payload.data)); setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar os ganhos na página."); }
    finally { setBusy(false); }
  }

  if (!settings) return <p role="alert" className="text-sm">Não foi possível consultar os ganhos na página agora. Tente novamente em instantes.</p>;

  return <form onSubmit={save} className={ownerPanelClass}>
    <h2 className={ownerPanelTitleClass}>Ganhos na página</h2>
    <p className="text-sm">Seu público ganha {currencyLabel} mesmo sem live: uma vez por dia ao visitar sua comunidade logado, e quando você escolhe uma sugestão dele em Jogos, Vídeos para reagir ou Inspirações.</p>
    <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div className="grid content-start gap-3">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={draft.presenceEnabled} onChange={(e) => change({ presenceEnabled: e.target.checked })} />
          Ganhar na visita do dia
        </label>
        <label className="grid gap-2 text-sm font-bold">{currencyLabel} por visita
          <Input type="number" min={1} max={10000} step={1} required value={draft.presenceAmount} onChange={(e) => change({ presenceAmount: e.target.value })} />
        </label>
      </div>
      <div className="grid content-start gap-3">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={draft.suggestionBonusEnabled} onChange={(e) => change({ suggestionBonusEnabled: e.target.checked })} />
          Ganhar quando a sugestão é escolhida
        </label>
        <label className="grid gap-2 text-sm font-bold">{currencyLabel} por sugestão escolhida
          <Input type="number" min={1} max={10000} step={1} required value={draft.suggestionBonusAmount} onChange={(e) => change({ suggestionBonusAmount: e.target.value })} />
        </label>
      </div>
    </fieldset>
    <p className="text-sm">Cada sugestão rende uma vez só, mesmo que volte para a votação e seja escolhida de novo. Pausar os ganhos preserva os saldos.</p>
    {error && <p role="alert" className="text-sm">{error}</p>}
    {saved && <p role="status" className="text-sm">Ganhos na página salvos.</p>}
    <div><Button type="submit" disabled={busy}>{busy ? "Aguarde..." : "Salvar ganhos na página"}</Button></div>
  </form>;
}
