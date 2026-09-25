"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ownerPanelClass, ownerPanelTitleClass } from "@/components/ui/owner-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currencySettingsSchema } from "@/lib/creators/currency";

export function CreatorCurrencyForm({ creatorId, initial }: { creatorId: string; initial?: string }) {
  const router = useRouter();
  const embedded = initial !== undefined;
  const [open, setOpen] = useState(embedded);
  const [currencyLabel, setCurrencyLabel] = useState(initial ?? "");
  const [loaded, setLoaded] = useState(embedded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const endpoint = `/api/me/creator-area/${encodeURIComponent(creatorId)}/currency`;

  async function readResponse(response: Response) {
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Não foi possível salvar a moeda.");
    return currencySettingsSchema.parse(payload.data);
  }

  async function load() {
    setOpen(true); setBusy(true); setError(null); setSaved(false); setLoaded(false);
    try {
      const data = await readResponse(await fetch(endpoint, { cache: "no-store" }));
      setCurrencyLabel(data.currencyLabel); setLoaded(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível consultar a moeda."); }
    finally { setBusy(false); }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = currencySettingsSchema.safeParse({ currencyLabel });
    setSaved(false);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true); setError(null);
    try {
      const data = await readResponse(await fetch(endpoint, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data),
      }));
      setCurrencyLabel(data.currencyLabel); setSaved(true); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar a moeda."); }
    finally { setBusy(false); }
  }

  return <div className={embedded ? "" : "mt-3"}>
    {!embedded && <Button type="button" variant="neutral" disabled={busy} onClick={() => {
      if (open) setOpen(false); else void load();
    }}>{open ? "Fechar edição da moeda" : "Editar nome da moeda"}</Button>}
    {open && <form onSubmit={save} className={`${embedded ? "" : "mt-3 "}${embedded ? ownerPanelClass : "grid gap-3 border-2 border-[var(--color-ink)] p-4"}`}>
      {embedded && <h2 className={ownerPanelTitleClass}>Moeda da comunidade</h2>}
      <label className="grid gap-2 text-sm font-bold">
        Nome da moeda
        <Input value={currencyLabel} maxLength={32} disabled={busy || !loaded} onChange={(event) => {
          setCurrencyLabel(event.target.value); setSaved(false); setError(null);
        }} />
      </label>
      {error && <p role="alert" className="text-sm">{error}</p>}
      {saved && <p role="status" className="text-sm">Nome da moeda salvo.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !loaded}>{busy ? "Aguarde..." : "Salvar moeda"}</Button>
        {!loaded && !busy && <Button type="button" variant="neutral" onClick={() => void load()}>Tentar novamente</Button>}
      </div>
    </form>}
  </div>;
}
