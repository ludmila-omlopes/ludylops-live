import { formatPipetz } from "@/lib/utils";

export function PipetzBalanceCard({
  displayName,
  currentBalance,
  compact = false,
}: {
  displayName: string;
  currentBalance: number;
  compact?: boolean;
}) {
  return (
    <section className="landing-plane surface-hero relative overflow-hidden py-8 sm:py-10">
      <div className="bg-dots-light pointer-events-none absolute inset-0 opacity-20" />

      <div className="relative mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className={`uppercase text-[var(--color-ink)] ${compact ? "text-2xl" : "text-4xl sm:text-5xl"}`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {displayName}
            </h1>
          </div>

          <div className="text-right">
            <div
              className={`inline-block rounded-[var(--radius)] border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] px-5 py-3 ${compact ? "" : "shadow-purple"}`}
            >
              <p
                className={`text-[var(--color-purple-bold)] ${compact ? "text-3xl" : "text-4xl sm:text-6xl"}`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {formatPipetz(currentBalance)}
              </p>
            </div>
            <p className="mono mt-2 text-xs uppercase tracking-[0.15em] text-[var(--color-ink-soft)]">
              pipetz
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
