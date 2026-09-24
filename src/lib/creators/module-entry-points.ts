import type { CreatorModuleKey } from "./modules";

/** Reviewed ownership inventory. Shared identity, builder recovery and infrastructure are explicit exceptions. */
export const modulePages: Record<string, CreatorModuleKey[]> = {
  "/apostas": ["bets"],
  "/ranking": ["ranking"],
  "/me": ["points", "redemptions"],
  "/contadores": ["streamerbot"],
  "/jogos": ["game_suggestions"],
  "/videos": ["video_suggestions"],
  "/indicacoes": ["creator_suggestions"],
  "/produtinhos": ["product_recommendations"],
  "/c/[creatorSlug]/produtinhos": ["product_recommendations"],
  "/quotes": ["quotes"],
  "/c/[creatorSlug]/quotes": ["quotes"],
  "/c/[creatorSlug]/moeda": ["points"],
  "/c/[creatorSlug]/ranking": ["ranking"],
  "/obs/quotes": ["quotes", "obs_overlays"],
  "/obs/bets": ["bets", "obs_overlays"],
  "/obs/likes": ["points", "obs_overlays"],
  "/obs/subscribers": ["points", "obs_overlays"],
  "/obs/wheel": ["obs_overlays"],
};

export const moduleApiGroups: Record<string, CreatorModuleKey[]> = {
  "/api/c/[creatorSlug]/ranking": ["ranking"],
  "/api/bets": ["bets"],
  "/api/catalog": ["redemptions"],
  "/api/leaderboard": ["ranking"],
  "/api/viewers": ["ranking"],
  "/api/viewers/[youtubeChannelId]": ["points"],
  "/api/recommendations": ["product_recommendations"],
  "/api/games/search": ["game_suggestions"],
  "/api/me": ["points", "redemptions"],
  "/api/me/balance": ["points"],
  "/api/me/link-code": ["streamerbot"],
  "/api/me/redeem": ["redemptions"],
  "/api/me/redemptions": ["redemptions"],
  "/api/me/bets": ["bets"],
  "/api/me/game-suggestions": ["game_suggestions"],
  "/api/me/video-suggestions": ["video_suggestions"],
  "/api/me/creator-suggestions": ["creator_suggestions"],
  "/api/me/quotes": ["quotes"],
  "/api/admin/bets": ["bets"],
  "/api/admin/catalog": ["redemptions"],
  "/api/admin/redemptions": ["redemptions"],
  "/api/admin/bridge-status": ["redemptions"],
  "/api/admin/game-suggestions": ["game_suggestions"],
  "/api/admin/video-suggestions": ["video_suggestions"],
  "/api/admin/creator-suggestions": ["creator_suggestions"],
  "/api/admin/recommendations": ["product_recommendations"],
  "/api/admin/current-game": ["streamerbot"],
  "/api/admin/death-counter-game": ["streamerbot"],
  "/api/admin/death-counters": ["streamerbot"],
  "/api/admin/live-status": ["streamerbot"],
  "/api/admin/live-like-goals": ["points", "obs_overlays"],
  "/api/admin/obs-overlays": ["quotes", "obs_overlays"],
  "/api/admin/pipetz-pricing": ["points"],
  "/api/admin/viewers": ["points"],
  "/api/admin/viewers/link": ["points", "streamerbot"],
  "/api/admin/viewers/attach-channel": ["points", "streamerbot"],
  "/api/admin/wheel": ["obs_overlays"],
  "/api/obs/quotes": ["quotes", "obs_overlays"],
  "/api/obs/bets": ["bets", "obs_overlays"],
  "/api/obs/likes": ["points", "obs_overlays"],
  "/api/obs/subscribers": ["points", "obs_overlays"],
  "/api/obs/wheel": ["obs_overlays"],
  "/api/obs/live-status": ["obs_overlays"],
};

export const sharedApiGroups = {
  "/api/auth": "Global authentication",
  "/api/owner":
    "Platform-owner recovery and configuration; existing role checks remain mandatory",
  "/api/me/creator-area": "Builder provisioning, owner-verified currency configuration and isolated economy adjustments",
  "/api/admin/creator-area-access": "Platform beta access configuration",
  "/api/admin/periodic-messages": "Admin-only legacy streamer configuration; active creator and installed/disabled Streamer.bot module verified in storage",
  "/api/internal/google": "Global account protection",
  "/api/internal/ps-plus": "Shared reference catalog synchronization",
  "/api/health": "Health without module data",
};

/** Verified integration adapters; these never take creator identity from URL/body hints. */
export const integrationApiGroups: Record<string, CreatorModuleKey[]> = {
  "/api/internal/bridge": ["redemptions"],
  "/api/internal/steam/sync": ["game_suggestions"],
  "/api/internal/streamerbot/events": ["points", "streamerbot"],
  "/api/internal/streamerbot/economy": ["points", "streamerbot"],
  "/api/internal/streamerbot/chat-rewards": ["points", "streamerbot"],
  "/api/internal/streamerbot/periodic-messages": ["streamerbot"],
  "/api/internal/streamerbot/link": ["points", "streamerbot"],
  "/api/internal/streamerbot/points": ["points", "streamerbot"],
  "/api/internal/streamerbot/bets": ["bets"],
  "/api/internal/streamerbot/counters": ["streamerbot"],
  "/api/internal/streamerbot/deaths": ["streamerbot"],
  "/api/internal/streamerbot/quotes": ["quotes"],
  "/api/internal/streamerbot/wheel": ["obs_overlays"],
  "/api/internal/streamerbot/credentials/check": ["streamerbot"],
};

export const aggregatePages = {
  "/": "Individually gated bets and Streamer.bot reads; effective navigation and points content",
  "/admin":
    "Individually gated module queries and controls; platform beta recovery remains available",
};

export const sharedPages = {
  "/criar-area": "Creator provisioning",
  "/owner": "Platform-owner configuration and recovery",
  "/c/[creatorSlug]":
    "Creator identity, branding and availability; no unscoped operational data",
  "/privacy": "Privacy policy",
  "/terms": "Terms",
};

export function modulesForApi(pathname: string) {
  if (
    Object.keys(sharedApiGroups).some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  )
    return null;
  const prefix = Object.keys(moduleApiGroups)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return prefix ? moduleApiGroups[prefix] : null;
}
