"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatPipetz } from "@/lib/utils";
import { redemptionStatusLabels, redemptionTimeline, type AdminRedemption } from "@/lib/redemptions/history";

export function AdminRedemptionsPanel({ entries }: { entries: AdminRedemption[] }) {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [pending, refresh] = useTransition();
  const router = useRouter();
  const search = query.trim().toLocaleLowerCase("pt-BR");
  const visible = entries.filter((entry) => (!status || entry.status === status) &&
    (!search || [entry.id, entry.itemName, entry.viewerName].some((value) => value.toLocaleLowerCase("pt-BR").includes(search))));
  return <section className="panel surface-section min-w-0 p-4 sm:p-6">
    <h2 className="text-3xl uppercase" style={{ fontFamily: "var(--font-display)" }}>Histórico de resgates</h2>
    <p className="mt-2 text-sm">Até 100 resgates mais recentes. A conclusão registra a confirmação da bridge.</p>
    <div className="mt-5 flex flex-wrap items-end gap-3">
      <label className="grid min-w-0 flex-1 gap-1 text-sm font-bold">Buscar resgate
        <input className="min-w-0 border-2 border-[var(--color-ink)] bg-[var(--color-paper)] p-2" placeholder="Pessoa, item ou ID" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="grid gap-1 text-sm font-bold"><label htmlFor="redemption-status">Status</label>
        <select id="redemption-status" className="border-2 border-[var(--color-ink)] bg-[var(--color-paper)] p-2" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos</option>{Object.entries(redemptionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <Button type="button" variant="neutral" disabled={pending} onClick={() => refresh(() => router.refresh())}>{pending ? "Atualizando…" : "Atualizar resgates"}</Button>
    </div>
    <p role="status" className="mt-3 text-sm">{visible.length} resgate(s) encontrado(s).</p>
    <div className="mt-4 grid gap-3">
      {visible.length === 0 && <p>Nenhum resgate encontrado.</p>}
      {visible.map((entry) => <details key={entry.id} className="card-brutal-static min-w-0 p-4">
        <summary className="cursor-pointer break-words font-bold">
          {entry.itemName} · {entry.viewerName} — {redemptionStatusLabels[entry.status]}
          <span className="mt-1 block text-sm font-normal">{formatPipetz(entry.costAtPurchase)} pipetz · {formatDateTime(entry.queuedAt)}</span>
        </summary>
        <div className="mt-4 grid gap-3 text-sm">
          <p className="break-all">ID: {entry.id}</p>
          <p>Execuções assumidas pela bridge: {entry.bridgeAttemptCount}</p>
          <ol className="grid gap-4 border-l-2 border-[var(--color-ink)] pl-4">
            {redemptionTimeline(entry).map((event) => <li key={event.label} className="break-words">
              <p className="font-bold">{event.label}</p>
              {event.at ? <time dateTime={event.at}>{formatDateTime(event.at)}</time> : <p>Horário não registrado.</p>}
              <p className="whitespace-pre-wrap">{event.detail}</p>
            </li>)}
          </ol>
        </div>
      </details>)}
    </div>
  </section>;
}
