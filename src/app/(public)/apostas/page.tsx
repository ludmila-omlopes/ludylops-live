import { auth } from "@/auth";
import { BetList } from "@/components/bet-list";
import { getViewerDashboard, listBets } from "@/lib/db/repository";

export default async function ApostasPage() {
  const session = await auth();
  const activeViewerId = session?.user?.activeViewerId ?? null;
  const [bets, dashboard] = await Promise.all([
    listBets(activeViewerId),
    activeViewerId ? getViewerDashboard(activeViewerId) : Promise.resolve(null),
  ]);
  const activeBets = bets.filter((b) => b.status === "open" || b.status === "locked");
  const resolvedBets = bets.filter((b) => b.status === "resolved" || b.status === "cancelled");
  const canBet = Boolean(activeViewerId && dashboard?.viewer.isLinked);

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
              Aposte pipetz nos desafios da live.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-ink-soft)] sm:text-base">
              Escolha um lado, coloque seus pipetz e torça. Se acertar, leva uma parte do pool!
            </p>
          </div>
        </div>
      </section>

      <BetList
        bets={activeBets}
        title="Apostas abertas"
        emptyMessage="Nenhuma aposta rolando agora. Aguarde a proxima live!"
        viewerBalance={dashboard?.balance.currentBalance}
        loggedIn={Boolean(session?.user)}
        canBet={canBet}
        fullWidth
        sectionClassName="bg-[var(--color-paper-pink)]"
      />

      {resolvedBets.length > 0 ? (
        <BetList
          bets={resolvedBets}
          title="Apostas encerradas"
          emptyMessage=""
          viewerBalance={dashboard?.balance.currentBalance}
          loggedIn={Boolean(session?.user)}
          canBet={canBet}
          fullWidth
          sectionClassName="bg-[var(--color-sky)]"
        />
      ) : null}
    </div>
  );
}

