"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { quoteBodySchema, type OwnedQuote, type OwnedQuotePage } from "@/lib/creators/quote-management";

export function CreatorQuoteManager({ creatorId, defaultOpen = false }: { creatorId: string; defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quotes, setQuotes] = useState<OwnedQuote[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<OwnedQuote | null>(null);
  const [correction, setCorrection] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pendingCreate = useRef<{ id: string; body: string } | null>(null);
  const endpoint = `/api/me/creator-area/${encodeURIComponent(creatorId)}/quotes`;
  async function receive<T>(response: Response): Promise<T> {
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Não foi possível consultar as frases.");
    return payload.data;
  }
  async function load(before?: number) {
    setOpen(true); setBusy(true); setError(null); setMessage(null);
    try {
      const data = await receive<OwnedQuotePage>(await fetch(endpoint + (before ? `?before=${before}` : ""), { cache: "no-store" }));
      setQuotes((previous) => before ? [...previous, ...data.quotes.filter((q) => !previous.some((p) => p.id === q.id))] : data.quotes);
      setNextBefore(data.nextBefore); setLoaded(true);
      if (!before) { setEditing(null); router.refresh(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível consultar as frases."); }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>, kind: "create" | "update") {
    event.preventDefault(); setError(null); setMessage(null);
    const parsed = quoteBodySchema.safeParse(kind === "create" ? draft : correction);
    if (!parsed.success) { setError("A frase deve ter de 1 a 500 caracteres."); return; }
    if (kind === "create" && pendingCreate.current?.body !== parsed.data)
      pendingCreate.current = { id: crypto.randomUUID(), body: parsed.data };
    const input = kind === "create" ? pendingCreate.current : { id: editing!.id, body: parsed.data, expectedBody: editing!.body };
    setBusy(true);
    try {
      const saved = await receive<OwnedQuote>(await fetch(endpoint, { method: kind === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" }, body: JSON.stringify(input) }));
      setQuotes((previous) => kind === "create" ? [saved, ...previous.filter((q) => q.id !== saved.id)]
        : previous.map((q) => q.id === saved.id ? saved : q));
      if (kind === "create") { setDraft(""); pendingCreate.current = null; } else setEditing(null);
      setMessage(`Frase #${saved.quoteNumber} ${kind === "create" ? "registrada" : "corrigida"}.`);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a frase."); }
    finally { setBusy(false); }
  }
  const textareaClass = "min-h-28 w-full min-w-0 rounded-none border-2 border-[var(--color-ink)] bg-[var(--color-paper)] p-3 text-[var(--color-ink)]";
  useEffect(() => {
    // Sections opened directly load their data once, like opening the toggle.
    if (defaultOpen) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <section id="gerenciar-frases" className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
    {!defaultOpen && <Button type="button" variant="neutral" disabled={busy} aria-expanded={open} onClick={() => open ? setOpen(false) : void load()}>Gerenciar frases</Button>}
    {open && <div className="mt-4 grid gap-5 border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] p-4">
      <h2 className="text-2xl font-black">Frases da sua comunidade</h2>
      <p className="text-sm">Registre os momentos da live e corrija o texto quando precisar. Cada frase mantém seu número e quem a registrou.</p>
      <form onSubmit={(e) => void save(e, "create")} className="grid gap-3">
        <label htmlFor={`${creatorId}-new-quote`} className="font-bold">Nova frase</label>
        <textarea id={`${creatorId}-new-quote`} className={textareaClass} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} required disabled={busy || !loaded} />
        <Button type="submit" disabled={busy || !loaded}>Registrar frase</Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <Button type="button" variant="neutral" disabled={busy} onClick={() => void load()}>Atualizar frases</Button>
      {loaded && quotes.length === 0 && <p>Nenhuma frase registrada ainda.</p>}
      <ul className="grid gap-4" aria-label="Frases para corrigir">
        {quotes.map((quote) => <li key={quote.id} className="min-w-0 border-t-2 border-[var(--color-ink)] pt-4">
          <h3 className="font-bold">Frase #{quote.quoteNumber}</h3>
          <p className="break-words text-sm">Registrada por {quote.createdByDisplayName}</p>
          {editing?.id === quote.id ? <form className="mt-3 grid gap-3" onSubmit={(e) => void save(e, "update")}>
            <label htmlFor={`${creatorId}-edit-${quote.id}`} className="font-bold">{`Corrigir frase #${quote.quoteNumber}`}</label>
            <textarea id={`${creatorId}-edit-${quote.id}`} className={textareaClass} value={correction} onChange={(e) => setCorrection(e.target.value)} maxLength={500} required disabled={busy} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>Salvar correção</Button>
              <Button type="button" variant="neutral" disabled={busy} onClick={() => setEditing(null)}>Cancelar correção</Button>
            </div>
          </form> : <>
            <p className="my-3 whitespace-pre-wrap break-words">{quote.body}</p>
            <Button type="button" variant="neutral" disabled={busy} onClick={() => { setEditing(quote); setCorrection(quote.body); setError(null); setMessage(null); }}>Corrigir frase #{quote.quoteNumber}</Button>
          </>}
        </li>)}
      </ul>
      {nextBefore && <Button type="button" variant="neutral" disabled={busy} onClick={() => void load(nextBefore)}>Carregar frases anteriores</Button>}
      {busy && <p role="status">Aguarde...</p>}
    </div>}
  </section>;
}
