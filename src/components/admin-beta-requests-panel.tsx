"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { CreatorAreaAccessSettingsRecord, CreatorBetaRequestRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type RequestPage = { requests: CreatorBetaRequestRecord[]; nextCursor: string | null };

async function fetchRequests(cursor?: string): Promise<RequestPage> {
  const response = await fetch(`/api/admin/creator-area-access/requests${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error ?? "Falha ao consultar os pedidos.");
  return result.data;
}

export function AdminBetaRequestsPanel({ onSettings }: { onSettings: (settings: CreatorAreaAccessSettingsRecord) => void }) {
  const [page, setPage] = useState<RequestPage>({ requests: [], nextCursor: null });
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    fetchRequests().then((data) => { if (active) setPage(data); })
      .catch((error) => { if (active) setFeedback(error.message); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  function load(cursor?: string) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const data = await fetchRequests(cursor);
        setPage((previous) => ({ ...data, requests: cursor ? [...previous.requests, ...data.requests] : data.requests }));
      } catch (error) { setFeedback(error instanceof Error ? error.message : "Falha ao consultar os pedidos."); }
    });
  }

  function review(request: CreatorBetaRequestRecord, decision: "approved" | "rejected") {
    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/creator-area-access/requests/${request.id}`, {
          method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error ?? "Falha ao analisar o pedido.");
        onSettings(result.data.settings);
        setPage((previous) => ({ ...previous, requests: previous.requests.filter((entry) => entry.id !== request.id) }));
        setFeedback(`${request.email}: ${decision === "approved" ? "acesso aprovado" : "pedido recusado"}.`);
      } catch (error) { setFeedback(error instanceof Error ? error.message : "Falha ao analisar o pedido."); }
    });
  }

  return (
    <section className="mt-8 border-t border-[var(--color-ink)] pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold uppercase" style={{ fontFamily: "var(--font-display)" }}>Solicitações de acesso</h3>
        <Button type="button" size="sm" disabled={!loaded || isPending} onClick={() => load()}>Atualizar pedidos</Button>
      </div>
      {!loaded ? <p className="mt-4 text-sm" role="status">Consultando os pedidos...</p> : null}
      {loaded && !page.requests.length && !feedback ? <p className="mt-4 text-sm">Nenhuma solicitação pendente.</p> : null}
      <ul className="mt-4 grid gap-3">
        {page.requests.map((request) => (
          <li key={request.id} className="flex flex-wrap items-center justify-between gap-4 border border-[var(--color-ink)] p-4">
            <div className="min-w-0">
              <p className="break-all text-sm font-bold">{request.email}</p>
              <p className="mt-1 text-sm">Solicitado em {formatDateTime(request.requestedAt)}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="success" disabled={isPending} aria-label={`Aprovar ${request.email}`} onClick={() => review(request, "approved")}>Aprovar</Button>
              <Button type="button" size="sm" disabled={isPending} aria-label={`Recusar ${request.email}`} onClick={() => review(request, "rejected")}>Recusar</Button>
            </div>
          </li>
        ))}
      </ul>
      {page.nextCursor ? <Button type="button" className="mt-4" size="sm" disabled={isPending} onClick={() => load(page.nextCursor!)}>Carregar mais pedidos</Button> : null}
      {feedback ? <p role="status" className="mt-4 text-sm font-medium">{feedback}</p> : null}
    </section>
  );
}
