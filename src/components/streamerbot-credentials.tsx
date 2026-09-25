"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { CopyField } from "@/components/ui/copy-field";
import { Input } from "@/components/ui/input";
import { ownerItemClass, ownerPanelClass, ownerPanelTitleClass } from "@/components/ui/owner-panel";
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
  return <section className={defaultOpen ? ownerPanelClass : "mt-5 border-t-2 border-[var(--color-ink)] pt-4"}>
    {defaultOpen ? <h2 className={ownerPanelTitleClass}>Credenciais do Streamer.bot</h2> : <h4 className="text-lg font-bold">Credenciais do Streamer.bot</h4>}
    {!defaultOpen && <Button className="mt-3" type="button" variant="neutral" disabled={busy} onClick={() => {
      if (open) { setOpen(false); setIssued(null); }
      else { setOpen(true); void refresh(); }
    }}>{open ? "Fechar credenciais" : "Gerenciar credenciais"}</Button>}
    {open && <div className={`${defaultOpen ? "" : "mt-4 "}grid min-w-0 gap-4 text-sm`}>
      <p>Use uma credencial exclusiva deste streamer. Ao substituir, a anterior funciona por mais 24 horas. A revogação bloqueia novas autenticações imediatamente.</p>
      {!canIssue && credentials !== null && <p>Ative o streamer e a integração com Streamer.bot para emitir uma credencial. Você ainda pode revogar credenciais existentes.</p>}
      {mode === "creator" && <div className="grid min-w-0 gap-3 break-words">
        <p>No Streamer.bot, salve o ID e o segredo em variáveis globais persistidas, do tipo texto. Depois execute o script de verificação em uma action manual com <strong>Core → C# → Execute C# Code</strong> e confira status 200 com o ID da sua comunidade no resultado.</p>
        <details className="min-w-0 border-[2px] border-[var(--color-ink)] p-4">
          <summary className="cursor-pointer font-bold">Detalhes técnicos</summary>
          <div className="mt-4 grid min-w-0 gap-3">
            <CopyField label="ID da comunidade" value={creatorId} />
            <CopyField label="Variável da origem HTTPS da comunidade" value="lojaneon.appBaseUrl" />
            <CopyField label="Variável do ID da credencial" value="lojaneon.streamerbotCredentialId" />
            <CopyField label="Variável do segredo" value="lojaneon.streamerbotCredentialSecret" />
            <CopyField label="Script de verificação" value="check-credential.cs" />
            <p className="text-[var(--color-ink-soft)]">A origem é o endereço HTTPS da sua comunidade, sem caminho nem barra final.</p>
          </div>
        </details>
        <a className="font-bold underline" href="https://github.com/ludmila-omlopes/ludylops-live/blob/master/docs/streamerbot-credentials.md" target="_blank" rel="noreferrer">Instruções e scripts de configuração</a>
        <p>A última autenticação confirma que uma requisição foi aceita. Ela não confirma conexão contínua nem execução de resgates. Cada resgate exige uma action configurada e o bridge em execução.</p>
      </div>}
      {error && <p role="alert">{error}</p>}
      {issued && <div className="grid min-w-0 gap-3 border-[3px] border-[var(--color-ink)] bg-[var(--color-sky)] p-4">
        <p role="status" className="font-bold">Salve o ID e o segredo agora. Ao fechar ou atualizar, o segredo será ocultado e não poderá ser consultado novamente.</p>
        <label className="grid min-w-0 gap-2 font-bold">ID da credencial<Input readOnly value={issued.id} autoComplete="off" /></label>
        <label className="grid min-w-0 gap-2 font-bold">Segredo<Input className="font-mono" readOnly value={issued.secret} autoComplete="off" spellCheck={false} /></label>
        <Button type="button" variant="neutral" onClick={() => setIssued(null)}>Já salvei; ocultar segredo</Button>
      </div>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="neutral" size="sm" disabled={busy} onClick={() => void refresh()}>Atualizar credenciais</Button>
        <Button type="button" size="sm" disabled={busy || !canIssue || credentials === null || credentials.some((item) => item.status === "active") || issued !== null} onClick={() => void mutate("create")}>Criar credencial</Button>
      </div>
      {credentials?.length === 0 && <p>Nenhuma credencial emitida.</p>}
      {credentials?.map((item) => <div key={item.id} className={ownerItemClass}>
        <code className="break-all">{item.id}</code>
        <p>{item.status === "active" ? "Ativa" : item.status === "retiring" ? "Em substituição" : "Revogada"}
          {item.retiringUntil && ` · Validade da transição: ${formatDateTime(item.retiringUntil)}`}</p>
        <p>Última autenticação: {item.lastUsedAt ? formatDateTime(item.lastUsedAt) : "Ainda não registrada"}</p>
        <div className="flex flex-wrap gap-2">
          {item.status === "active" && <Button type="button" variant="neutral" size="sm" disabled={busy || !canIssue || issued !== null} onClick={() => void mutate("rotate", item.id)}>Substituir credencial</Button>}
          {item.status !== "revoked" && <ConfirmButton size="sm" disabled={busy} confirmLabel="Confirmar revogação" onConfirm={() => mutate("revoke", item.id)}>Revogar credencial</ConfirmButton>}
        </div>
      </div>)}
    </div>}
  </section>;
}
