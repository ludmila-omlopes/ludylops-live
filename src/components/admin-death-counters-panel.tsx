"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StreamerbotCounterSummaryRecord } from "@/lib/types";

const TOTAL_KEY = "death_count";
const DAILY_KEY = "death_count_daily";

type CounterDraft = {
  scopeType: "global" | "game";
  scopeKey: string;
  scopeLabel: string | null;
  total: number;
  daily: number;
};

export function AdminDeathCountersPanel({ counters }: { counters: StreamerbotCounterSummaryRecord[] }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const initialCounters = useMemo(() => {
    const groups = new Map<string, CounterDraft>();
    for (const counter of counters.filter((entry) => entry.key === TOTAL_KEY || entry.key === DAILY_KEY)) {
      const id = `${counter.scopeType}:${counter.scopeKey}`;
      const current = groups.get(id) ?? {
        scopeType: counter.scopeType,
        scopeKey: counter.scopeKey,
        scopeLabel: counter.scopeLabel,
        total: 0,
        daily: 0,
      };
      if (counter.key === TOTAL_KEY) current.total = counter.value;
      if (counter.key === DAILY_KEY) current.daily = counter.value;
      groups.set(id, current);
    }
    return [...groups.values()].filter((entry) => entry.scopeType === "global" || entry.total > 0 || entry.daily > 0);
  }, [counters]);
  const [drafts, setDrafts] = useState(initialCounters);

  function updateDraft(index: number, field: "total" | "daily", value: string) {
    const parsed = Number.parseInt(value, 10);
    setDrafts((entries) => entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, [field]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 } : entry)));
  }

  function saveDraft(entry: CounterDraft) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const updates = ([
          [TOTAL_KEY, entry.total],
          [DAILY_KEY, entry.daily],
        ] as const).map(async ([counterKey, value]) => {
          const response = await fetch("/api/admin/death-counters", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ counterKey, scopeType: entry.scopeType, scopeKey: entry.scopeKey, scopeLabel: entry.scopeLabel, value }),
          });
          const payload = (await response.json()) as { ok?: boolean; error?: string };
          if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Falha ao salvar contador.");
        });
        await Promise.all(updates);
        setFeedback("Contadores atualizados.");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao salvar contador.");
      }
    });
  }

  return (
    <div className="panel surface-section p-6">
      <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "var(--font-display)" }}>Contadores de mortes</h2>
      <p className="mt-3 text-sm leading-7 text-[var(--color-ink-soft)]">Edite o total acumulado e o contador do dia de cada campanha. O diário segue o fuso de São Paulo.</p>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {drafts.map((entry, index) => (
          <div key={`${entry.scopeType}:${entry.scopeKey}`} className="card-brutal-static surface-card p-4">
            <p className="text-xl font-black uppercase">{entry.scopeType === "global" ? "Todas as campanhas" : entry.scopeLabel ?? entry.scopeKey}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">Total<Input className="mt-2" type="number" min="0" value={entry.total} onChange={(event) => updateDraft(index, "total", event.target.value)} /></label>
              <label className="mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">Hoje<Input className="mt-2" type="number" min="0" value={entry.daily} onChange={(event) => updateDraft(index, "daily", event.target.value)} /></label>
            </div>
            <Button className="mt-4" type="button" size="sm" variant="admin" disabled={isPending} onClick={() => saveDraft(entry)}>{isPending ? "Salvando..." : "Salvar contadores"}</Button>
          </div>
        ))}
      </div>
      {drafts.length === 0 ? <p className="mt-5 text-sm text-[var(--color-ink-soft)]">Nenhum contador de mortes foi registrado ainda.</p> : null}
      {feedback ? <div className="retro-label neutral-chip mt-4">{feedback}</div> : null}
    </div>
  );
}
