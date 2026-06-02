import type { PipetzSpendingHistoryRecord } from "@/lib/types";
import { formatDateTime, formatPipetz } from "@/lib/utils";

export function PipetzSpendingHistoryCard({
  entries,
}: {
  entries: PipetzSpendingHistoryRecord[];
}) {
  const visibleEntries = entries.slice(0, 12);

  return (
    <section className="landing-plane bg-[var(--color-paper)] py-8 sm:py-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mono text-xs uppercase tracking-[0.24em] text-[var(--color-ink-soft)]">
              Histórico
            </p>
            <h2 className="text-2xl uppercase text-[var(--color-ink)]" style={{ fontFamily: "var(--font-display)" }}>
              Gastos de pipetz
            </h2>
          </div>
          <p className="max-w-xl text-sm text-[var(--color-ink-soft)]">
            Resgates, apostas, quotes no OBS, sugestões, indicações e boosts debitados da sua conta.
          </p>
        </div>

        <div className="overflow-hidden rounded-[var(--radius)] border-[3px] border-[var(--color-ink)] bg-[var(--surface-card)]">
          {visibleEntries.length > 0 ? (
            <ul className="divide-y-[3px] divide-[var(--color-ink)]">
              {visibleEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-ink)]">{entry.label}</p>
                    <p className="mono mt-1 text-xs uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                      {entry.source}
                    </p>
                  </div>
                  <p className="mono text-sm text-[var(--color-ink-soft)]">
                    {formatDateTime(entry.occurredAt)}
                  </p>
                  <p className="text-right text-xl font-black text-[var(--color-purple-bold)]">
                    -{formatPipetz(entry.amount)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-[var(--color-ink-soft)]">
              Nenhum gasto de pipetz registrado ainda.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
