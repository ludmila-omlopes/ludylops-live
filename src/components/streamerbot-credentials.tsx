"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

type Credential = { id: string; status: string; retiringUntil: string | null; lastUsedAt: string | null };
type Issued = { id: string; secret: string };

async function readResult<T>(response: Response): Promise<T> {
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error ?? "Não foi possível atualizar as credenciais.");
  return result.data as T;
}

export function StreamerbotCredentials({ creatorId, enabled, mode = "platform", defaultOpen = false }: { creatorId: string; enabled: boolean; mode?: "platform" | "creator"; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [credentials, setCredentials] = useState<Credential[] | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ownerCanIssue, setOwnerCanIssue] = useState(false);
  const canIssue = enabled && (mode === "platform" || ownerCanIssue);
  const endpoint = `${mode === "creator" ? "/api/me/creator-area" : "/api/owner/creators"}/${encodeURIComponent(creatorId)}/streamerbot-credentials`;

  async function load() {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (mode === "creator") {
        const data = await readResult<{ credentials: Credential[]; canIssue: boolean }>(response);
        setCredentials(data.credentials); setOwnerCanIssue(data.canIssue);
      } else setCredentials(await readResult<Credential[]>(response));
    } catch (error) {
      setCredentials(null); setOwnerCanIssue(false);
      throw error;
    }
  }

  async function refresh() {
    setBusy(true);
    setError(null);
    setIssued(null);
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

  useEffect(() => {
    // Sections opened directly load their data once, like opening the toggle.
    if (defaultOpen) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <section className="mt-5 border-t-2 border-[var(--color-ink)] pt-4">
    {defaultOpen ? <h2 className="text-2xl font-bold">Credenciais do Streamer.bot</h2> : <h4 className="text-lg font-bold">Credenciais do Streamer.bot</h4>}
    {!defaultOpen && <Button className="mt-3" type="button" variant="neutral" disabled={busy} onClick={() => {
      if (open) { setOpen(false); setIssued(null); }
      else { setOpen(true); void refresh(); }
    }}>{open ? "Fechar credenciais" : "Gerenciar credenciais"}</Button>}
    {open && <div className="mt-4 grid gap-3 text-sm">
      <p>Use uma credencial exclusiva deste streamer. Ao substituir, a anterior funciona por mais 24 horas. A revogação bloqueia novas autenticações imediatamente.</p>
      {!canIssue && credentials !== null && <p>Ative o streamer e a integração com Streamer.bot para emitir uma credencial. Você ainda pode revogar credenciais existentes.</p>}
      {mode === "creator" && <div className="grid gap-2 break-words">
        <p>No Streamer.bot, salve o ID e o segredo em variáveis globais persistidas, do tipo texto:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><code className="break-all">lojaneon.appBaseUrl</code>: a origem HTTPS usada para acessar sua comunidade, sem caminho nem barra final.</li>
          <li><code className="break-all">lojaneon.streamerbotCredentialId</code>: o ID emitido.</li>
          <li><code className="break-all">lojaneon.streamerbotCredentialSecret</code>: o segredo emitido.</li>
        </ul>
        <p>Execute <code>check-credential.cs</code> em uma action manual com <strong>Core → C# → Execute C# Code</strong>. Confira status 200 e o streamer <code className="break-all">{creatorId}</code> no resultado.</p>
        <a className="font-bold underline" href="https://github.com/ludmila-omlopes/ludylops-live/blob/master/docs/streamerbot-credentials.md" target="_blank" rel="noreferrer">Instruções e scripts de configuração</a>
        <p>A última autenticação confirma que uma requisição foi aceita. Ela não confirma conexão contínua nem execução de resgates. Cada resgate exige uma action configurada e o bridge em execução.</p>
      </div>}
      {error && <p role="alert">{error}</p>}
      {issued && <div className="grid gap-2 border-2 border-[var(--color-ink)] p-3">
        <p role="status">Salve o ID e o segredo agora. Ao fechar ou atualizar, o segredo será ocultado e não poderá ser consultado novamente.</p>
        <label>ID da credencial<input className="mt-1 w-full border p-2" readOnly value={issued.id} autoComplete="off" /></label>
        <label>Segredo<input className="mt-1 w-full border p-2 font-mono" readOnly value={issued.secret} autoComplete="off" spellCheck={false} /></label>
        <Button type="button" variant="neutral" onClick={() => setIssued(null)}>Já salvei; ocultar segredo</Button>
      </div>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="neutral" disabled={busy} onClick={() => void refresh()}>Atualizar credenciais</Button>
        <Button type="button" disabled={busy || !canIssue || credentials === null || credentials.some((item) => item.status === "active") || issued !== null} onClick={() => void mutate("create")}>Criar credencial</Button>
      </div>
      {credentials?.length === 0 && <p>Nenhuma credencial emitida.</p>}
      {credentials?.map((item) => <div key={item.id} className="grid gap-2 border-2 border-[var(--color-ink)] p-3">
        <code className="break-all">{item.id}</code>
        <p>{item.status === "active" ? "Ativa" : item.status === "retiring" ? "Em substituição" : "Revogada"}
          {item.retiringUntil && ` · Validade da transição: ${formatDateTime(item.retiringUntil)}`}</p>
        <p>Última autenticação: {item.lastUsedAt ? formatDateTime(item.lastUsedAt) : "Ainda não registrada"}</p>
        <div className="flex flex-wrap gap-2">
          {item.status === "active" && <Button type="button" variant="neutral" disabled={busy || !canIssue || issued !== null} onClick={() => void mutate("rotate", item.id)}>Substituir credencial</Button>}
          {item.status !== "revoked" && <Button type="button" variant="danger" disabled={busy} onClick={() => void mutate("revoke", item.id)}>Revogar credencial</Button>}
        </div>
      </div>)}
    </div>}
  </section>;
}
