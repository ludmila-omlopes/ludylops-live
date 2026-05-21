import { AdminObsOverlaysPanel } from "@/components/admin-obs-overlays-panel";
import { AdminCurrentGamePanel } from "@/components/admin-current-game-panel";
import { AdminDashboardTabs } from "@/components/admin-dashboard-tabs";
import { AdminBetsPanel } from "@/components/admin-bets-panel";
import { AdminGameSuggestionsPanel } from "@/components/admin-game-suggestions-panel";
import { AdminVideoSuggestionsPanel } from "@/components/admin-video-suggestions-panel";
import { AdminPipetzPricingPanel } from "@/components/admin-pipetz-pricing-panel";
import { AdminPipetzAirdropPanel } from "@/components/admin-pipetz-airdrop-panel";
import { AdminRecommendationsPanel } from "@/components/admin-recommendations-panel";
import { AdminViewerLinksPanel } from "@/components/admin-viewer-links-panel";
import { RedemptionGrid } from "@/components/redemption-grid";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { LiveStatusPanel } from "@/components/live-status-panel";
import { requireAdminSession } from "@/lib/auth/session";
import {
  getBridgeStatus,
  getCatalog,
  getLeaderboard,
  getObsOverlayAdminStatus,
  getPipetzPricing,
  listAdminViewerDirectory,
  listAdminGameSuggestions,
  listAdminVideoSuggestions,
  listAdminProductRecommendations,
  listAdminBets,
  listAdminRedemptions,
} from "@/lib/db/repository";
import { getStreamerbotLivestreamStatus } from "@/lib/streamerbot/live-status";
import { getCurrentGame } from "@/lib/current-game";
import { formatDateTime, formatPipetz } from "@/lib/utils";

const statusColorMap: Record<string, string> = {
  queued: "var(--color-lavender)",
  claimed: "var(--color-sky)",
  completed: "var(--color-mint)",
  failed: "var(--color-rose)",
  cancelled: "var(--color-periwinkle)",
};

export default async function AdminPage() {
  await requireAdminSession();
  const [catalog, leaderboard, bridge, liveStatus, currentGame, redemptions, bets, suggestions, videoSuggestions, recommendations, viewers, obsOverlayStatus, pricing] = await Promise.all([
    getCatalog(),
    getLeaderboard(),
    getBridgeStatus(),
    getStreamerbotLivestreamStatus(),
    getCurrentGame(),
    listAdminRedemptions(),
    listAdminBets(),
    listAdminGameSuggestions(),
    listAdminVideoSuggestions(),
    listAdminProductRecommendations(),
    listAdminViewerDirectory(),
    getObsOverlayAdminStatus(),
    getPipetzPricing(),
  ]);

  return (
    <div className="flex w-full flex-col">
      <section className="landing-plane surface-hero py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <p className="mono text-xs font-bold uppercase tracking-[0.32em] text-[var(--color-ink-soft)]">
            Painel operacional
          </p>
          <h1
            className="mt-3 text-4xl uppercase sm:text-6xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Admin Pipetz
          </h1>
        </div>
      </section>

      <AdminDashboardTabs
        tabs={[
          {
            id: "apostas",
            label: "Apostas",
            description: "Ciclo de vida, travas e pagamentos.",
            badge: `${bets.length}`,
            content: <AdminBetsPanel bets={bets} embedded />,
          },
          {
            id: "comunidade",
            label: "Comunidade",
            description: "Vínculos, indicações e recomendações.",
            badge: `${suggestions.length + videoSuggestions.length + recommendations.length}`,
            content: (
              <div className="space-y-6">
                <AdminViewerLinksPanel entries={viewers} />
                <AdminGameSuggestionsPanel suggestions={suggestions} />
                <AdminVideoSuggestionsPanel suggestions={videoSuggestions} />
                <AdminRecommendationsPanel recommendations={recommendations} />
              </div>
            ),
          },
          {
            id: "operacao",
            label: "Operação",
            description: "Live, overlays, mortes e preços.",
            badge: liveStatus.isLive ? "ao vivo" : "offline",
            content: (
              <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-6">
                  <LiveStatusPanel bridge={bridge} initialStatus={liveStatus} />
                  <AdminCurrentGamePanel initialGame={currentGame} />
                  <AdminPipetzPricingPanel initialPricing={pricing} />
                </div>
                <AdminObsOverlaysPanel initialStatus={obsOverlayStatus} />
              </div>
            ),
          },
          {
            id: "pipetz",
            label: "Pipetz",
            description: "Fila, ranking, airdrop e catálogo.",
            badge: `${redemptions.length}`,
            content: (
              <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-6">
                  <div className="panel surface-section p-6">
                    <p className="mono text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
                      Fila recente
                    </p>
                    <div className="mt-6 grid gap-3">
                      {redemptions.slice(0, 6).map((entry) => {
                        const statusBg = statusColorMap[entry.status] ?? "var(--color-paper)";
                        return (
                          <div key={entry.id} className="card-brutal-static p-4">
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className="badge-brutal px-2 py-1 text-[10px] text-[var(--color-ink)]"
                                style={{ backgroundColor: statusBg }}
                              >
                                {entry.status}
                              </span>
                              <span className="mono text-xs font-bold uppercase tracking-[0.18em]">
                                {formatPipetz(entry.costAtPurchase)} pipetz
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                              {formatDateTime(entry.queuedAt)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="panel surface-section p-6">
                    <p className="mono text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
                      Ranking de pipetz
                    </p>
                    <div className="mt-6">
                      <LeaderboardTable entries={leaderboard.slice(0, 10)} />
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <AdminPipetzAirdropPanel viewers={viewers} />
                  <RedemptionGrid items={catalog} expanded staticCards />
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
