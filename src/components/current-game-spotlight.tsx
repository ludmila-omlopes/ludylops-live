import type { CurrentGameRecord } from "@/lib/types";

export function CurrentGameSpotlight({
  game,
}: {
  game: CurrentGameRecord | null;
}) {
  if (!game) {
    return null;
  }

  const metadata = [
    game.releaseYear,
    ...game.platforms.slice(0, 2),
    ...game.genres.slice(0, 2),
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <section className="landing-plane landing-divider bg-[var(--color-paper)] py-8 sm:py-10">
      <div className="mx-auto w-full max-w-[1520px] px-4 sm:px-6 lg:px-10">
        <div className="grid overflow-hidden border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] shadow-[6px_6px_0_var(--shadow-color)] lg:grid-cols-[280px_1fr]">
          <div className="min-h-72 border-b-[3px] border-[var(--color-ink)] bg-[var(--color-lavender)] lg:border-b-0 lg:border-r-[3px]">
            {game.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={game.coverImageUrl} alt={`Capa de ${game.name}`} className="h-full min-h-72 w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-72 items-center justify-center px-6 text-center text-3xl font-black uppercase">
                {game.name}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-8">
            <p className="mono text-[11px] font-black uppercase tracking-[0.28em] text-[var(--color-ink-soft)]">
              jogando agora
            </p>
            <h2 className="mt-3 text-4xl uppercase leading-[0.9] sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
              {game.name}
            </h2>
            {metadata ? (
              <p className="mono mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
                {metadata}
              </p>
            ) : null}
            <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-[var(--color-ink-soft)] sm:text-base">
              Esse é o jogo em destaque da live agora, para a comunidade reconhecer de cara o que está rolando.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
