"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { creatorColorInk, creatorProfileSchema, safeCreatorColor, type CreatorProfile } from "@/lib/creators/profile";

export function CreatorProfileForm({ creatorId, initial }: { creatorId: string; initial?: CreatorProfile }) {
  const router = useRouter();
  const embedded = Boolean(initial);
  const [open, setOpen] = useState(embedded);
  const [busy, setBusy] = useState(false);
  const [expected, setExpected] = useState<CreatorProfile | null>(initial ?? null);
  const [draft, setDraft] = useState<CreatorProfile>(initial ?? { displayName: "", primaryColor: "#c7a2e9", accentColor: "#40a9ff" });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const endpoint = `/api/me/creator-area/${encodeURIComponent(creatorId)}/profile`;
  async function receive(response: Response) {
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Não foi possível salvar o nome e as cores.");
    return creatorProfileSchema.parse(payload.data);
  }
  async function load() {
    setOpen(true); setBusy(true); setError(null); setSaved(false); setExpected(null);
    try { const profile = await receive(await fetch(endpoint, { cache: "no-store" })); setDraft(profile); setExpected(profile); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível consultar os dados."); }
    finally { setBusy(false); }
  }
  function change(key: keyof CreatorProfile, value: string) {
    setDraft((profile) => ({ ...profile, [key]: value })); setSaved(false);
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setSaved(false);
    const parsed = creatorProfileSchema.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      const profile = await receive(await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: parsed.data, expected }) }));
      setDraft(profile); setExpected(profile); setSaved(true); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar os dados."); }
    finally { setBusy(false); }
  }
  const primary = safeCreatorColor(draft.primaryColor, "#c7a2e9");
  const accent = safeCreatorColor(draft.accentColor, "#40a9ff");
  return <div className={embedded ? "" : "mt-3"}>
    {!embedded && <Button type="button" variant="neutral" aria-expanded={open} disabled={busy} onClick={() => open ? setOpen(false) : void load()}>
      {open ? "Fechar nome e cores" : "Editar nome e cores"}
    </Button>}
    {open && <form onSubmit={save} className="mt-3 grid gap-4 border-2 border-[var(--color-ink)] p-4">
      <h2 className="text-xl font-bold">Nome e cores da comunidade</h2>
      <fieldset disabled={busy || !expected} className="grid min-w-0 gap-4">
        <label className="grid gap-2 text-sm font-bold">Nome do streamer
          <Input value={draft.displayName} onChange={(e) => change("displayName", e.target.value)} required minLength={2} maxLength={80} />
        </label>
        {([ ["primaryColor", "Cor principal"], ["accentColor", "Cor de destaque"] ] as const).map(([key, label]) => <div key={key} className="grid gap-2">
          <label htmlFor={`${creatorId}-${key}`} className="text-sm font-bold">{label}</label>
          <div className="flex min-w-0 gap-3">
            <input type="color" aria-label={`Escolher ${label.toLowerCase()}`} className="h-11 w-12 shrink-0 cursor-pointer border-2 border-[var(--color-ink)]"
              value={safeCreatorColor(draft[key], "#c7a2e9")} onChange={(e) => change(key, e.target.value)} />
            <Input id={`${creatorId}-${key}`} value={draft[key]} pattern="#[0-9a-fA-F]{6}" required maxLength={7} onChange={(e) => change(key, e.target.value)} />
          </div>
        </div>)}
      </fieldset>
      {expected && <div className="overflow-hidden border-2 border-[var(--color-ink)]" aria-label="Amostra das cores">
        <div className="break-words p-5 text-2xl font-black" style={{ backgroundColor: primary, color: creatorColorInk(primary) }}>{draft.displayName || "Sua comunidade"}</div>
        <div className="h-3" style={{ backgroundColor: accent }} />
      </div>}
      {error && <p role="alert" className="text-sm">{error}</p>}
      {saved && <p role="status" className="text-sm">Nome e cores salvos.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !expected}>{busy ? "Aguarde..." : "Salvar nome e cores"}</Button>
        <Button type="button" variant="neutral" disabled={busy} onClick={() => void load()}>Recarregar dados</Button>
      </div>
    </form>}
  </div>;
}
