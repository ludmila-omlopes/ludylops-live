import { BetCard } from "@/components/bet-card";
import type { BetWithOptionsRecord } from "@/lib/types";

export function BetList({
  bets,
  title,
  subtitle,
  emptyMessage,
  accentBg,
  viewerBalance,
  loggedIn = false,
  canBet = false,
  fullWidth = false,
  sectionClassName,
  id,
}: {
  bets: BetWithOptionsRecord[];
  title: string;
  subtitle?: string;
  emptyMessage: string;
  accentBg?: string;
  viewerBalance?: number | null;
  loggedIn?: boolean;
  canBet?: boolean;
  fullWidth?: boolean;
  sectionClassName?: string;
  id?: string;
}) {
  if (bets.length === 0 && emptyMessage) {
    const emptyState = (
      <div className="border-l-[6px] border-[var(--color-ink)] bg-[var(--color-paper)] p-5">
        <p className="text-base font-black uppercase leading-6 text-[var(--color-ink)]">
          {emptyMessage}
        </p>
        <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-[var(--color-ink-soft)]">
          Quando uma aposta abrir, ela aparece aqui com opções, pool e estado de participação.
        </p>
      </div>
    );

    if (fullWidth) {
      return (
        <section
          id={id}
          className={`landing-plane landing-divider scroll-mt-28 py-8 sm:py-10 ${sectionClassName ?? accentBg ?? "bg-[var(--color-lilac)]"}`}
        >
          <div className="mx-auto w-full max-w-[1520px] px-4 sm:px-6 lg:px-10">{emptyState}</div>
        </section>
      );
    }

    return <div className={`p-6 ${accentBg ?? "bg-[var(--color-lilac)]"}`}>{emptyState}</div>;
  }

  if (bets.length === 0) return null;

  const header = (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h2
            className="text-balance text-3xl uppercase leading-none sm:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[var(--color-ink-soft)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        <span className="mono w-fit border border-[var(--color-ink)] bg-[var(--color-paper)] px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-ink)]">
          {bets.length} {bets.length === 1 ? "rodada" : "rodadas"}
        </span>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {bets.map((bet) => (
          <BetCard
            key={bet.id}
            bet={bet}
            viewerBalance={viewerBalance}
            loggedIn={loggedIn}
            canBet={canBet}
          />
        ))}
      </div>
    </>
  );

  if (fullWidth) {
    return (
      <section
        id={id}
        className={`landing-plane landing-divider scroll-mt-28 py-8 sm:py-10 ${sectionClassName ?? "surface-section"}`}
      >
        <div className="mx-auto w-full max-w-[1520px] px-4 sm:px-6 lg:px-10">{header}</div>
      </section>
    );
  }

  return <section className="surface-section p-6 sm:p-8">{header}</section>;
}
