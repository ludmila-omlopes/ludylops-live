"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Credential = { id: string; status: string; retiringUntil: string | null; lastUsedAt: string | null };
type Issued = { id: string; secret: string };

async function readResult<T>(response: Response): Promise<T> {
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error ?? "Não foi possível atualizar as credenciais.");
  return result.data as T;
}

export function StreamerbotCredentials({ creatorId, enabled }: { creatorId: string; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<Credential[] | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/owner/creators/${encodeURIComponent(creatorId)}/streamerbot-credentials`;

  async function load() {
    setCredentials(await readResult<Credential[]>(await fetch(endpoint, { cache: "no-store" })));
  }

  async function refresh() {
    setBusy(true);
    setError(null);
    try { await load(); } catch (error) { setError(error instanceof Error ? error.message : "Falha ao consultar credenciais."); }
    finally { setBusy(false); }
  }

  async function mutate(action: "create" | "rotate" | "revoke", credentialId?: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await readResult<Issued>(await fetch(endpoint, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, credentialId }),
      }));
      if (action !== "revoke") setIssued(result);
      else if (issued?.id === credentialId) setIssued(null);
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : "Falha ao atualizar credenciais."); }
    finally { setBusy(false); }
  }

  return <section className="mt-5 border-t-2 border-[var(--color-ink)] pt-4">
    <h4 className="text-lg font-bold">Credenciais do Streamer.bot</h4>
    <Button className="mt-3" type="button" variant="neutral" disabled={busy} onClick={() => {
      if (open) { setOpen(false); setIssued(null); }
      else { setOpen(true); void refresh(); }
    }}>{open ? "Fechar credenciais" : "Gerenciar credenciais"}</Button>
    {open && <div className="mt-4 grid gap-3 text-sm">
      <p>Use uma credencial exclusiva deste streamer. Ao substituir, a anterior funciona por mais 24 horas. A revogação bloqueia novas autenticações imediatamente.</p>
      {!enabled && <p>Ative o streamer e a integração com Streamer.bot para emitir uma credencial.</p>}
      {error && <p role="alert">{error}</p>}
      {issued && <div className="grid gap-2 border-2 border-[var(--color-ink)] p-3">
        <p role="status">Salve o ID e o segredo agora. O segredo não poderá ser consultado novamente.</p>
        <label>ID da credencial<input className="mt-1 w-full border p-2" readOnly value={issued.id} autoComplete="off" /></label>
        <label>Segredo<input className="mt-1 w-full border p-2 font-mono" readOnly value={issued.secret} autoComplete="off" spellCheck={false} /></label>
        <Button type="button" variant="neutral" onClick={() => setIssued(null)}>Já salvei; ocultar segredo</Button>
      </div>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="neutral" disabled={busy} onClick={() => void refresh()}>Atualizar credenciais</Button>
        <Button type="button" disabled={busy || !enabled || credentials === null || credentials.some((item) => item.status === "active") || issued !== null} onClick={() => void mutate("create")}>Criar credencial</Button>
      </div>
      {credentials?.length === 0 && <p>Nenhuma credencial emitida.</p>}
      {credentials?.map((item) => <div key={item.id} className="grid gap-2 border-2 border-[var(--color-ink)] p-3">
        <code className="break-all">{item.id}</code>
        <p>{item.status === "active" ? "Ativa" : item.status === "retiring" ? "Em substituição" : "Revogada"}
          {item.retiringUntil && ` · Validade da transição: ${new Date(item.retiringUntil).toLocaleString("pt-BR")}`}</p>
        <p>Última autenticação: {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString("pt-BR") : "Ainda não registrada"}</p>
        <div className="flex flex-wrap gap-2">
          {item.status === "active" && <Button type="button" variant="neutral" disabled={busy || !enabled || issued !== null} onClick={() => void mutate("rotate", item.id)}>Substituir credencial</Button>}
          {item.status !== "revoked" && <Button type="button" variant="danger" disabled={busy} onClick={() => void mutate("revoke", item.id)}>Revogar credencial</Button>}
        </div>
      </div>)}
    </div>}
  </section>;
}
