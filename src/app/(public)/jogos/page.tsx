import { auth } from "@/auth";
import { GameSuggestionList } from "@/components/game-suggestion-list";
import { getPipetzPricing, getViewerDashboard, listGameSuggestions } from "@/lib/db/repository";
import { adminEmails, isDemoMode } from "@/lib/env";

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
  const isAdmin = Boolean(
    session?.user?.email && (isDemoMode || adminEmails.has(session.user.email.toLowerCase())),
  );

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
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <GameSuggestionList
            suggestions={suggestions}
            loggedIn={Boolean(session?.user)}
            canInteract={canInteract}
            isAdmin={isAdmin}
            viewerBalance={viewerBalance}
            creationCost={pricing.gameSuggestionCost}
          />
        </div>
      </section>
    </div>
  );
}
