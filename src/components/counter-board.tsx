import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StreamerbotCounterSummaryRecord } from "@/lib/types";
import { formatPipetz } from "@/lib/utils";

const DEATH_COUNTER_KEY = "death_count";

function scopeHeading(scopeKey: string, scopeLabel: string | null) {
  return scopeLabel ?? scopeKey.replace(/[_-]+/g, " ");
}

function CounterCard({ counter }: { counter: StreamerbotCounterSummaryRecord }) {
  return (
    <Card variant="poster" className="h-full bg-[var(--color-paper)] p-5">
      <CardHeader className="gap-0">
        <CardTitle
          className="text-3xl uppercase leading-none sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {counter.label}
        </CardTitle>
      </CardHeader>

      <CardContent className="mt-6">
        <div className="micro-flat inline-flex border-[3px] border-[var(--color-ink)] bg-[var(--color-purple)] px-4 py-2 shadow-[4px_4px_0_var(--shadow-color)]">
          <span
            className="text-3xl uppercase leading-none text-[var(--color-accent-ink)] sm:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {formatPipetz(counter.value)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function GameCounterGroup({
  scopeKey,
  entries,
  current,
}: {
  scopeKey: string;
  entries: StreamerbotCounterSummaryRecord[];
  current?: boolean;
}) {
  return (
    <div className="landing-plane h-full bg-[var(--color-paper-pink)] p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h3
          className="text-3xl uppercase leading-none"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {scopeHeading(scopeKey, entries[0]?.scopeLabel ?? null)}
        </h3>
        {current ? (
          <span className="mono border-2 border-[var(--color-ink)] bg-[var(--color-mint)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
            contador atual
          </span>
        ) : null}
      </div>

      <div className="grid gap-4">
        {entries.map((counter) => (
          <CounterCard key={`${counter.scopeType}:${counter.scopeKey}:${counter.key}`} counter={counter} />
        ))}
      </div>
    </div>
  );
}

export function CounterBoard({
  counters,
  currentScopeKey,
}: {
  counters: StreamerbotCounterSummaryRecord[];
  currentScopeKey?: string | null;
}) {
  const gameGroups = counters
    .filter((counter) => counter.scopeType === "game")
    .reduce<Map<string, StreamerbotCounterSummaryRecord[]>>((groups, counter) => {
      const existing = groups.get(counter.scopeKey) ?? [];
      existing.push(counter);
      groups.set(counter.scopeKey, existing);
      return groups;
    }, new Map());
  const gameGroupEntries = Array.from(gameGroups.entries());
  const currentGameGroup = currentScopeKey
    ? gameGroupEntries.find(([scopeKey]) => scopeKey === currentScopeKey)
    : undefined;
  const currentGameHasDeathCounter = currentGameGroup?.[1].some(
    (counter) => counter.key === DEATH_COUNTER_KEY,
  );
  const globalCounters = counters.filter(
    (counter) =>
      counter.scopeType === "global" &&
      !(currentGameHasDeathCounter && counter.key === DEATH_COUNTER_KEY),
  );
  const otherGameGroups = currentScopeKey
    ? gameGroupEntries.filter(([scopeKey]) => scopeKey !== currentScopeKey)
    : gameGroupEntries;

  return (
    <div className="space-y-10">
      {currentGameGroup ? (
        <section>
          <GameCounterGroup scopeKey={currentGameGroup[0]} entries={currentGameGroup[1]} current />
        </section>
      ) : null}

      {globalCounters.length > 0 ? (
        <section>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {globalCounters.map((counter) => (
              <CounterCard key={`${counter.scopeType}:${counter.scopeKey}:${counter.key}`} counter={counter} />
            ))}
          </div>
        </section>
      ) : null}

      {otherGameGroups.length > 0 ? (
        <section className="space-y-8">
          <div className="grid gap-8 xl:grid-cols-2">
            {otherGameGroups.map(([scopeKey, entries]) => (
              <GameCounterGroup key={scopeKey} scopeKey={scopeKey} entries={entries} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
