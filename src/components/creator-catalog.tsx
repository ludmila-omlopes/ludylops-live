"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ownerFieldClass, ownerPanelClass, ownerPanelTitleClass } from "@/components/ui/owner-panel";
import { Button } from "@/components/ui/button";
import type { CreatorCatalogItem, PublicCatalogItem } from "@/lib/creators/redemptions";

const inputClass = ownerFieldClass;
export function CreatorCatalog({ items, slug, currencyLabel, signedIn }: { items: PublicCatalogItem[]; slug: string; currencyLabel: string; signedIn: boolean }) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const attempts = useRef<Record<string, string>>({});
  const router = useRouter();
  function purchase(itemId: string) {
    start(async () => {
      attempts.current[itemId] ??= crypto.randomUUID();
      try {
        const response = await fetch(`/api/creators/${encodeURIComponent(slug)}/redeem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, operationKey: attempts.current[itemId] }) });
        const result = await response.json();
        if (!response.ok) { setMessage(result.error); return; }
        delete attempts.current[itemId];
        setMessage("Seu resgate entrou na fila da live."); router.refresh();
      } catch { setMessage("Não foi possível confirmar o resgate. Tente novamente; a mesma solicitação não será cobrada duas vezes."); }
    });
  }
  return <section className="grid min-w-0 gap-4">
    <h2 className="text-2xl font-bold">Escolha o próximo momento da live</h2>
    {!items.length && <p>Ainda não há resgates disponíveis.</p>}
    {!signedIn && <a className="font-bold underline" href={`/api/auth/signin?callbackUrl=${encodeURIComponent(`/c/${slug}/resgates`)}`}>Entre para resgatar</a>}
    <p role="status">{message}</p>
    <div className="grid gap-4 sm:grid-cols-2">{items.map((item) => <article key={item.id} className="card-brutal-static grid min-w-0 gap-3 p-4">
      <h3 className="break-words text-xl font-bold">{item.name}</h3><p className="whitespace-pre-wrap break-words">{item.description}</p>
      <p className="font-bold">{item.cost.toLocaleString("pt-BR")} {currencyLabel}</p>
      <p>{item.stock === null ? "Sem limite de unidades" : `${item.stock} unidade(s) disponível(is)`}</p>
      {(item.globalCooldownSeconds > 0 || item.viewerCooldownSeconds > 0) && <p className="text-sm">Intervalo: {item.globalCooldownSeconds}s entre resgates; {item.viewerCooldownSeconds}s por pessoa.</p>}
      <Button disabled={!signedIn || pending || item.stock === 0} onClick={() => purchase(item.id)}>{item.stock === 0 ? "Esgotado" : "Resgatar"}</Button>
    </article>)}</div>
  </section>;
}
const blank: CreatorCatalogItem = { id: "", revision: 0, name: "", description: "", cost: 10, stock: null, isActive: false, globalCooldownSeconds: 0, viewerCooldownSeconds: 0, streamerbotActionRef: "" };
export function CreatorCatalogManager({ items, creatorId, currencyLabel }: { items: CreatorCatalogItem[]; creatorId: string; currencyLabel: string }) {
  const [draft, setDraft] = useState<CreatorCatalogItem>(blank), [message, setMessage] = useState("");
  const [pending, start] = useTransition(); const router = useRouter();
  return <section className={ownerPanelClass}>
    <h2 className={ownerPanelTitleClass}>Seus itens para a live</h2>
    <p>Associe cada item a uma ação do seu Streamer.bot. Novos itens começam pausados.</p>
    <ul className="grid gap-2">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
      <span className="min-w-0 break-words">{item.name} · {item.isActive ? "Ativo" : "Pausado"}</span>
      <Button variant="neutral" disabled={pending} onClick={() => { setDraft({ id: item.id, revision: item.revision, name: item.name, description: item.description, cost: item.cost, stock: item.stock, isActive: item.isActive, globalCooldownSeconds: item.globalCooldownSeconds, viewerCooldownSeconds: item.viewerCooldownSeconds, streamerbotActionRef: item.streamerbotActionRef }); setMessage(""); }}>Editar {item.name}</Button>
    </li>)}</ul>
    <Button variant="neutral" disabled={pending} onClick={() => { setDraft(blank); setMessage(""); }}>Novo item</Button>
    <form className="grid min-w-0 gap-4" onSubmit={(event) => { event.preventDefault(); start(async () => {
      const payload = { ...draft, id: draft.id || crypto.randomUUID() };
      setDraft(payload);
      try {
        const response = await fetch(`/api/me/creator-area/${creatorId}/catalog`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok) { setMessage(result.error); router.refresh(); return; }
        setDraft(blank); setMessage("Item salvo."); router.refresh();
      } catch { setMessage("Não foi possível confirmar. Atualize os itens antes de tentar novamente."); }
    }); }}>
      <h3 className="text-xl font-bold">{draft.id ? "Editar item" : "Criar item"}</h3>
      <label className="grid gap-1">Nome<input className={inputClass} required maxLength={120} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
      <label className="grid gap-1">Descrição<textarea className={inputClass} maxLength={1000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1">Preço em {currencyLabel}<input className={inputClass} type="number" required min={1} max={1000000} step={1} value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) })} /></label>
        <label className="grid gap-1">Estoque (vazio = ilimitado)<input className={inputClass} type="number" min={0} max={1000000} step={1} value={draft.stock ?? ""} onChange={(e) => setDraft({ ...draft, stock: e.target.value === "" ? null : Number(e.target.value) })} /></label>
        <label className="grid gap-1">Intervalo global em segundos<input className={inputClass} type="number" required min={0} max={86400} step={1} value={draft.globalCooldownSeconds} onChange={(e) => setDraft({ ...draft, globalCooldownSeconds: Number(e.target.value) })} /></label>
        <label className="grid gap-1">Intervalo por pessoa em segundos<input className={inputClass} type="number" required min={0} max={86400} step={1} value={draft.viewerCooldownSeconds} onChange={(e) => setDraft({ ...draft, viewerCooldownSeconds: Number(e.target.value) })} /></label>
      </div>
      <label className="grid gap-1">ID ou nome da ação no Streamer.bot<input className={inputClass} required maxLength={255} value={draft.streamerbotActionRef} onChange={(e) => setDraft({ ...draft, streamerbotActionRef: e.target.value })} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />Disponível para resgatar</label>
      <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar item"}</Button>
    </form><p role="status">{message}</p>
  </section>;
}
