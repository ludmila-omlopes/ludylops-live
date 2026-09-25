"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecommendationImageLookup } from "@/components/recommendation-image-lookup";
import { creatorRecommendationSchema, emptyRecommendation, recommendationInput,
  type CreatorRecommendation, type CreatorRecommendationInput, type CreatorRecommendationPage } from "@/lib/creators/recommendations";

export function CreatorRecommendationManager({ creatorId, defaultOpen = false }: { creatorId: string; defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false);
  const [items, setItems] = useState<CreatorRecommendation[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [editing, setEditing] = useState<CreatorRecommendation | null>(null);
  const [draft, setDraft] = useState<CreatorRecommendationInput>({ ...emptyRecommendation });
  const [error, setError] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null);
  const pending = useRef<{ id: string; content: string } | null>(null);
  const endpoint = `/api/me/creator-area/${encodeURIComponent(creatorId)}/recommendations`;
  async function receive<T>(response: Response): Promise<T> {
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Não foi possível acessar os produtos.");
    return payload.data;
  }
  async function load(after?: string) {
    setOpen(true); setBusy(true); setError(null); setMessage(null);
    try {
      const data = await receive<CreatorRecommendationPage>(await fetch(endpoint + (after ? `?cursor=${encodeURIComponent(after)}` : ""), { cache: "no-store" }));
      setItems((previous) => after ? [...previous, ...data.items.filter((r) => !previous.some((p) => p.id === r.id))] : data.items);
      setCursor(data.nextCursor); setLoaded(true);
      if (!after) { setEditing(null); setDraft({ ...emptyRecommendation }); router.refresh(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível consultar os produtos."); }
    finally { setBusy(false); }
  }
  function change<K extends keyof CreatorRecommendationInput>(key: K, value: CreatorRecommendationInput[K]) {
    setDraft((current) => ({ ...current, [key]: value })); setMessage(null);
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setMessage(null);
    const parsed = creatorRecommendationSchema.safeParse(draft);
    if (!parsed.success) { setError("Confira os campos: nome, categoria e loja precisam de pelo menos 2 caracteres; o motivo, de 8. Use links válidos."); return; }
    const content = JSON.stringify(parsed.data);
    if (!editing && pending.current?.content !== content) pending.current = { id: crypto.randomUUID(), content };
    const input = editing ? { id: editing.id, item: parsed.data, expected: recommendationInput(editing) }
      : { id: pending.current!.id, item: parsed.data };
    setBusy(true);
    try {
      const saved = await receive<CreatorRecommendation>(await fetch(endpoint, { method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify(input) }));
      setItems((previous) => editing ? previous.map((r) => r.id === saved.id ? saved : r) : [saved, ...previous.filter((r) => r.id !== saved.id)]);
      setEditing(null); setDraft({ ...emptyRecommendation }); pending.current = null;
      setMessage(saved.isActive ? "Produto publicado para a comunidade." : "Produto salvo como oculto."); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar o produto."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    // Sections opened directly load their data once, like opening the toggle.
    if (defaultOpen) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <section className="my-6">
    {!defaultOpen && <Button type="button" variant="neutral" disabled={busy} aria-expanded={open} onClick={() => open ? setOpen(false) : void load()}>Gerenciar produtos</Button>}
    {open && <div className="mt-4 grid gap-5 border-[3px] border-[var(--color-ink)] p-4 sm:p-6">
      <h2 className="text-2xl font-black">Produtos que você indica</h2>
      <form onSubmit={save} className="grid gap-4">
        <fieldset disabled={busy || !loaded} className="grid min-w-0 gap-4 sm:grid-cols-2">
          {([ ["name", "Nome do produto", 255], ["category", "Categoria", 32], ["storeLabel", "Loja", 120],
            ["href", "Link do produto", 2000], ["imageUrl", "Imagem (opcional)", 2000] ] as const).map(([key, label, max]) =>
            <label key={key} className="grid min-w-0 gap-2 text-sm font-bold">{label}
              <Input value={draft[key]} maxLength={max} required={key !== "imageUrl"} onChange={(e) => change(key, e.target.value)} />
            </label>)}
          <label className="grid gap-2 text-sm font-bold">Tipo de link
            <select className="min-w-0 border-2 border-[var(--color-ink)] bg-[var(--color-paper)] p-3" value={draft.linkKind} onChange={(e) => change("linkKind", e.target.value as CreatorRecommendationInput["linkKind"])}>
              <option value="external">Externo</option><option value="affiliate">Afiliado</option>
            </select>
          </label>
          <div className="min-w-0 sm:col-span-2">
            <RecommendationImageLookup endpoint={`${endpoint}/image`} href={draft.href} imageUrl={draft.imageUrl}
              scopeKey={editing?.id ?? "new"} disabled={busy || !loaded} onImage={(url) => change("imageUrl", url)} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <label htmlFor={`${creatorId}-recommendation-context`} className="text-sm font-bold">Por que você indica?</label>
            <textarea id={`${creatorId}-recommendation-context`} className="min-h-28 w-full min-w-0 border-2 border-[var(--color-ink)] bg-[var(--color-paper)] p-3" value={draft.context} minLength={8} maxLength={500} required onChange={(e) => change("context", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
            <input type="checkbox" checked={draft.isActive} onChange={(e) => change("isActive", e.target.checked)} /> Publicar para a comunidade
          </label>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !loaded}>{editing ? "Salvar alterações" : "Adicionar produto"}</Button>
          {editing && <Button type="button" variant="neutral" disabled={busy} onClick={() => { setEditing(null); setDraft({ ...emptyRecommendation }); }}>Cancelar edição</Button>}
        </div>
      </form>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <Button type="button" variant="neutral" disabled={busy} onClick={() => void load()}>Atualizar produtos</Button>
      {loaded && !items.length && <p>Você ainda não cadastrou produtos.</p>}
      <ul aria-label="Seus produtos" className="grid gap-4">
        {items.map((product) => <li key={product.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--color-ink)] pt-4">
          <div className="min-w-0"><h3 className="break-words font-black">{product.name}</h3><p className="text-sm">{product.isActive ? "Publicado" : "Oculto"}</p></div>
          <Button type="button" variant="neutral" disabled={busy} aria-label={`Editar ${product.name}`} onClick={() => { setEditing(product); setDraft(recommendationInput(product)); setError(null); setMessage(null); }}>Editar</Button>
        </li>)}
      </ul>
      {cursor && <Button type="button" variant="neutral" disabled={busy} onClick={() => void load(cursor)}>Carregar produtos anteriores</Button>}
      {busy && <p role="status">Aguarde...</p>}
    </div>}
  </section>;
}
