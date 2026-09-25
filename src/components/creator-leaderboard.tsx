import type { CreatorRanking } from "@/lib/creators/ranking";

export function CreatorLeaderboard({ currencyLabel, entries }: CreatorRanking) {
  if (!entries.length) return <p>Os primeiros {currencyLabel} ainda estão chegando.</p>;
  return <div className="overflow-hidden border-[3px] border-[var(--color-ink)] shadow-[4px_4px_0_var(--shadow-color)]">
    <div aria-hidden="true" className="grid grid-cols-[2.5rem_minmax(0,1fr)_6rem] gap-2 border-b-[3px] border-[var(--color-ink)] bg-[var(--color-blue)] px-3 py-3 text-sm font-bold text-[var(--color-accent-ink)] sm:grid-cols-[4rem_minmax(0,1fr)_10rem] sm:px-5">
      <span>#</span><span>Participante</span><span className="text-right">Saldo</span>
    </div>
    <ol aria-label={`Ranking de ${currencyLabel}`}>
      {entries.map((entry) => <li key={entry.position} className="grid grid-cols-[2.5rem_minmax(0,1fr)_6rem] items-center gap-2 border-b-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-3 py-4 last:border-b-0 sm:grid-cols-[4rem_minmax(0,1fr)_10rem] sm:px-5">
        <span className="font-bold"><span className="sr-only">Posição </span>{entry.position}</span>
        <div className="min-w-0">
          <p className="break-words font-black">{entry.displayName}</p>
          {entry.handle && <p className="break-all text-sm text-[var(--color-ink-soft)]">{entry.handle}</p>}
        </div>
        <span className="min-w-0 break-words text-right font-bold">{entry.currentBalance.toLocaleString("pt-BR")}<span className="sr-only"> {currencyLabel}</span></span>
      </li>)}
    </ol>
  </div>;
}
