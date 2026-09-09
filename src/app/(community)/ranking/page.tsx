import { LeaderboardTable } from "@/components/leaderboard-table";
import { getLeaderboard } from "@/lib/db/repository";

export default async function RankingPage() {
  const leaderboard = await getLeaderboard();

  return (
    <div className="flex w-full flex-col">
      <section className="landing-plane surface-hero relative overflow-hidden py-8 sm:py-10">
        <div className="bg-dots-light pointer-events-none absolute inset-0 opacity-15" />
        <div className="relative mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <div>
            <h1
              className="text-4xl uppercase sm:text-6xl lg:text-7xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Quem ta mandando na live.
            </h1>
          </div>
        </div>
      </section>
      <section className="landing-plane landing-divider bg-[var(--color-sky)] py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <LeaderboardTable entries={leaderboard} />
        </div>
      </section>
    </div>
  );
}
