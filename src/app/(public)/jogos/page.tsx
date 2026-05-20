import { auth } from "@/auth";
import { GameSuggestForm } from "@/components/game-suggest-form";
import { GameSuggestionList } from "@/components/game-suggestion-list";
import { getPipetzPricing, getViewerDashboard, listGameSuggestions } from "@/lib/db/repository";
import { adminEmails } from "@/lib/env";

export default async function JogosPage() {
  const session = await auth();
  const activeViewerId = session?.user?.activeViewerId ?? null;
  const [suggestions, dashboard, pricing] = await Promise.all([
    listGameSuggestions(activeViewerId),
    activeViewerId ? getViewerDashboard(activeViewerId) : Promise.resolve(null),
    getPipetzPricing(),
  ]);

  const viewerBalance = dashboard?.balance.currentBalance ?? null;
  const canInteract = Boolean(activeViewerId && dashboard?.viewer.isLinked);
  const isAdmin = Boolean(session?.user?.email && adminEmails.has(session.user.email.toLowerCase()));

  return (
    <div className="flex w-full flex-col">
      <section className="landing-plane surface-hero relative overflow-hidden py-8 sm:py-10">
        <div className="bg-dots-light pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <div>
            <h1
              className="text-4xl uppercase sm:text-6xl lg:text-7xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Me diz o que jogar.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-ink-soft)] sm:text-base">
              Sugere um jogo e, se quiser empurrar sua ideia, gasta pipetz pra dar boost nela.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-plane landing-divider bg-[var(--color-paper-pink)] py-8 dark:bg-[var(--surface-card-alt)] sm:py-10">
        <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.75fr)] lg:px-10">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <h2
                className="text-2xl font-bold uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Sugestões da galera
              </h2>
            </div>
            <GameSuggestionList
              suggestions={suggestions}
              loggedIn={Boolean(session?.user)}
              canInteract={canInteract}
              isAdmin={isAdmin}
              viewerBalance={viewerBalance}
            />
          </div>
          <div className="self-start lg:sticky lg:top-24">
            <GameSuggestForm
              loggedIn={Boolean(session?.user)}
              canSuggest={canInteract}
              viewerBalance={viewerBalance}
              creationCost={pricing.gameSuggestionCost}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
