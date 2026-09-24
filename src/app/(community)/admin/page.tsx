import { resolveLegacyModulePage } from "@/lib/creators/module-page-access";
import { defaultCreatorContext } from "@/lib/creators/context";
import { AdminObsOverlaysPanel } from "@/components/admin-obs-overlays-panel";
import { AdminStreamerbotScriptsPanel } from "@/components/admin-streamerbot-scripts-panel";
import { PeriodicMessagesManager } from "@/components/periodic-messages-manager";
import { AdminCurrentGamePanel } from "@/components/admin-current-game-panel";
import { AdminDashboardTabs } from "@/components/admin-dashboard-tabs";
import { AdminBetsPanel } from "@/components/admin-bets-panel";
import { AdminGameSuggestionsPanel } from "@/components/admin-game-suggestions-panel";
import { AdminVideoSuggestionsPanel } from "@/components/admin-video-suggestions-panel";
import { AdminPipetzPricingPanel } from "@/components/admin-pipetz-pricing-panel";
import { AdminPipetzAirdropPanel } from "@/components/admin-pipetz-airdrop-panel";
import { AdminLiveLikeGoalsPanel } from "@/components/admin-live-like-goals-panel";
import { AdminWheelPanel } from "@/components/admin-wheel-panel";
import { AdminRecommendationsPanel } from "@/components/admin-recommendations-panel";
import { AdminViewerLinksPanel } from "@/components/admin-viewer-links-panel";
import { AdminCreatorAreaAccessPanel } from "@/components/admin-creator-area-access-panel";
import { AdminCreatorSuggestionsPanel } from "@/components/admin-creator-suggestions-panel";
import { AdminDeathCountersPanel } from "@/components/admin-death-counters-panel";
import { RedemptionGrid } from "@/components/redemption-grid";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { LiveStatusPanel } from "@/components/live-status-panel";
import { requireAdminSession } from "@/lib/auth/session";
import { getCreatorAreaAccessSettings } from "@/lib/creators/access";
import {
  getBridgeStatus,
  getCatalog,
  getGameSuggestionBoostSettings,
  getLeaderboard,
  getObsOverlayAdminStatus,
  getPipetzPricing,
  listAdminViewerDirectory,
  listAdminGameSuggestions,
  listAdminVideoSuggestions,
  listAdminProductRecommendations,
  listAdminCreatorSuggestions,
  listAdminBets,
  listAdminLiveLikeGoals,
  listAdminRedemptions,
  listAdminStreamerbotCounters,
} from "@/lib/db/repository";
import { getStreamerbotLivestreamStatus } from "@/lib/streamerbot/live-status";
import { listStreamerbotScripts } from "@/lib/streamerbot/scripts.server";
import { getCurrentGame } from "@/lib/current-game";
import { formatDateTime, formatPipetz } from "@/lib/utils";
import { getWheelConfig } from "@/lib/wheel";

const statusColorMap: Record<string, string> = {
  queued: "var(--color-lavender)",
  claimed: "var(--color-sky)",
  completed: "var(--color-mint)",
  failed: "var(--color-rose)",
  cancelled: "var(--color-periwinkle)",
};

export default async function AdminPage() {
  await requireAdminSession();
  const { can } = await resolveLegacyModulePage();
  const [
    catalog,
    leaderboard,
    bridge,
    liveStatus,
    currentGame,
    redemptions,
    bets,
    likeGoals,
    suggestions,
    gameBoostSettings,
    videoSuggestions,
    recommendations,
    creatorSuggestions,
    viewers,
    obsOverlayStatus,
    pricing,
    wheelConfig,
    streamerbotScripts,
    creatorAreaAccessSettings,
    deathCounters,
  ] = await Promise.all([
    can("redemptions") ? getCatalog() : Promise.resolve([]),
    can("ranking") ? getLeaderboard({ limit: null }) : Promise.resolve([]),
    can("redemptions") ? getBridgeStatus() : Promise.resolve([]),
    can("streamerbot") ? getStreamerbotLivestreamStatus() : Promise.resolve(null),
    can("streamerbot") ? getCurrentGame() : Promise.resolve(null),
    can("redemptions") ? listAdminRedemptions() : Promise.resolve([]),
    can("bets") ? listAdminBets() : Promise.resolve([]),
    can("points","obs_overlays") ? listAdminLiveLikeGoals() : Promise.resolve([]),
    can("game_suggestions") ? listAdminGameSuggestions() : Promise.resolve([]),
    can("game_suggestions") ? getGameSuggestionBoostSettings() : Promise.resolve(null),
    can("video_suggestions") ? listAdminVideoSuggestions() : Promise.resolve([]),
    can("product_recommendations") ? listAdminProductRecommendations() : Promise.resolve([]),
    can("creator_suggestions") ? listAdminCreatorSuggestions() : Promise.resolve([]),
    can("points") ? listAdminViewerDirectory() : Promise.resolve([]),
    can("quotes", "obs_overlays") ? getObsOverlayAdminStatus(defaultCreatorContext) : Promise.resolve(null),
    can("points") ? getPipetzPricing() : Promise.resolve(null),
    can("obs_overlays") ? getWheelConfig() : Promise.resolve(null),
    Promise.resolve(can("streamerbot") ? listStreamerbotScripts() : []),
    getCreatorAreaAccessSettings(),
    can("streamerbot") ? listAdminStreamerbotCounters() : Promise.resolve([]),
  ]);
  const openBetCount = bets.filter((bet) => bet.status === "open").length;
  const queuedRedemptionCount = redemptions.filter((entry) => entry.status === "queued").length;
  const activeWheelOptionCount = wheelConfig?.options.filter(
    (option) => option.isActive && option.label.trim(),
  ).length ?? 0;

  return (
    <div className="flex w-full flex-col">
      <section className="landing-plane surface-hero py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10">
          <h1
            className="text-4xl uppercase sm:text-6xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Admin Pipetz
          </h1>
        </div>
      </section>

      <AdminDashboardTabs
        sections={[
          {
            id: "live",
            title: "Live e OBS",
            items: [
              ...(can("streamerbot") ? [{
                id: "status-live",
                label: "Status da live",
                description: "Bridge, modo manual e estado efetivo.",
                badge: liveStatus!.isLive ? "ao vivo" : "offline",
                content: <LiveStatusPanel bridge={bridge} initialStatus={liveStatus!} />,
              }] : []),
              ...(can("quotes","obs_overlays") ? [{
                id: "overlays",
                label: "Overlays",
                description: "Browser sources, fila e links do OBS.",
                badge: `${obsOverlayStatus!.pendingCount}`,
                content: <AdminObsOverlaysPanel initialStatus={obsOverlayStatus!} embedded />,
              }] : []),
              ...(can("streamerbot") ? [{
                id: "streamerbot",
                label: "Streamer.bot",
                description: "Scripts C#, triggers e globals da integração.",
                badge: `${streamerbotScripts.length}`,
                content: <><PeriodicMessagesManager /><AdminStreamerbotScriptsPanel scripts={streamerbotScripts} /></>,
              }] : []),
              ...(can("obs_overlays") ? [{
                id: "roleta",
                label: "Roleta",
                description: "Prêmios, pesos e overlay da roleta.",
                badge: `${activeWheelOptionCount}`,
                content: <AdminWheelPanel initialConfig={wheelConfig!} />,
              }] : []),
              ...(can("streamerbot") ? [{
                id: "jogo-atual",
                label: "Jogo atual",
                description: "Capa e metadados da landing page.",
                badge: currentGame ? "ativo" : undefined,
                content: <AdminCurrentGamePanel initialGame={currentGame} />,
              }] : []),
              ...(can("streamerbot") ? [{
                id: "contadores-mortes",
                label: "Contadores de mortes",
                description: "Totais e mortes do dia por campanha.",
                content: <AdminDeathCountersPanel counters={deathCounters} />,
              }] : []),
              ...(can("points","obs_overlays") ? [{
                id: "metas-likes",
                label: "Metas de likes",
                description: "Recompensas automáticas da live.",
                badge: `${likeGoals.length}`,
                content: <AdminLiveLikeGoalsPanel initialGoals={likeGoals} />,
              }] : []),
            ],
          },
          {
            id: "apostas",
            title: "Apostas",
            items: [
              ...(can("bets") ? [{
                id: "apostas-live",
                label: "Apostas da live",
                description: "Ciclo de vida, travas e pagamentos.",
                badge: `${openBetCount}/${bets.length}`,
                content: <AdminBetsPanel bets={bets} embedded />,
              }] : []),
            ],
          },
          {
            id: "comunidade",
            title: "Comunidade",
            items: [
              ...(can("points", "streamerbot") ? [{
                id: "vinculos",
                label: "Vínculos",
                description: "Contas Google e canais do YouTube.",
                badge: `${viewers.length}`,
                content: <AdminViewerLinksPanel entries={viewers} embedded />,
              }] : []),
              {
                id: "areas-criadores",
                label: "Beta áreas",
                description: "Emails liberados para criar área.",
                badge: `${creatorAreaAccessSettings.allowedEmails.length}`,
                content: <AdminCreatorAreaAccessPanel initialSettings={creatorAreaAccessSettings} />,
              },
              ...(can("creator_suggestions") ? [{
                id: "indicacoes-criadores",
                label: "Criadores indicados",
                description: "Indicações da comunidade e exclusões.",
                badge: `${creatorSuggestions.length}`,
                content: <AdminCreatorSuggestionsPanel suggestions={creatorSuggestions} />,
              }] : []),
              ...(can("game_suggestions") ? [{
                id: "sugestoes-jogos",
                label: "Sugestões de jogos",
                description: "Fila, prioridade e multiplicadores.",
                badge: `${suggestions.length}`,
                content: (
                  <AdminGameSuggestionsPanel
                    suggestions={suggestions}
                    boostSettings={gameBoostSettings!}
                    embedded
                  />
                ),
              }] : []),
              ...(can("video_suggestions") ? [{
                id: "videos",
                label: "Vídeos",
                description: "Sugestões para reação em live.",
                badge: `${videoSuggestions.length}`,
                content: <AdminVideoSuggestionsPanel suggestions={videoSuggestions} embedded />,
              }] : []),
              ...(can("product_recommendations") ? [{
                id: "produtos",
                label: "Produtos",
                description: "Recomendações públicas e links.",
                badge: `${recommendations.length}`,
                content: <AdminRecommendationsPanel recommendations={recommendations} />,
              }] : []),
            ],
          },
          {
            id: "pipetz",
            title: "Pipetz",
            items: [
              ...(can("points") ? [{
                id: "precos",
                label: "Preços",
                description: "Custos de ações pagas.",
                content: <AdminPipetzPricingPanel initialPricing={pricing!} />,
              }] : []),
              ...(can("points") ? [{
                id: "airdrop",
                label: "Airdrop",
                description: "Distribuição manual de pipetz.",
                content: <AdminPipetzAirdropPanel viewers={viewers} />,
              }] : []),
              ...(can("redemptions") ? [{
                id: "fila-resgates",
                label: "Fila de resgates",
                description: "Últimos resgates e status.",
                badge: `${queuedRedemptionCount}/${redemptions.length}`,
                content: (
                  <div className="panel surface-section p-6">
                    <h2
                      className="text-3xl uppercase"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Fila de resgates
                    </h2>
                    <div className="mt-6 grid gap-3">
                      {redemptions.length === 0 ? (
                        <div className="card-brutal-static p-4 text-sm font-bold text-[var(--color-ink-soft)]">
                          Nenhum resgate recente.
                        </div>
                      ) : null}
                      {redemptions.slice(0, 10).map((entry) => {
                        const statusBg = statusColorMap[entry.status] ?? "var(--color-paper)";
                        return (
                          <div key={entry.id} className="card-brutal-static p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
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
                ),
              }] : []),
              ...(can("ranking") ? [{
                id: "ranking",
                label: "Ranking",
                description: "Top viewers por saldo.",
                badge: `${leaderboard.length}`,
                content: (
                  <div className="panel surface-section p-6">
                    <h2
                      className="text-3xl uppercase"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Ranking de pipetz
                    </h2>
                    <div className="mt-6">
                      <LeaderboardTable entries={leaderboard.slice(0, 20)} />
                    </div>
                  </div>
                ),
              }] : []),
              ...(can("redemptions") ? [{
                id: "catalogo",
                label: "Catálogo",
                description: "Resgates disponíveis na loja.",
                badge: `${catalog.length}`,
                content: <RedemptionGrid items={catalog} expanded staticCards />,
              }] : []),
            ],
          },
        ].filter(section => section.items.length > 0)}
      />
    </div>
  );
}
