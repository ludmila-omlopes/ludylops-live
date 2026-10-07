import { readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const appDirectory = path.resolve(__dirname);

const expectedPageRoutes = new Set([
  "/",
  "/admin",
  "/admin/beta",
  "/me",
  "/apostas",
  "/contadores",
  "/indicacoes",
  "/jogos",
  "/produtinhos",
  "/quotes",
  "/ranking",
  "/videos",
  "/privacy",
  "/terms",
  "/owner",
  "/inicio",
  "/criar-area",
  "/comunidades",
  "/comunidades/nova",
  "/comunidades/[slug]",
  "/comunidades/[slug]/identidade",
  "/comunidades/[slug]/modulos",
  "/comunidades/[slug]/economia",
  "/comunidades/[slug]/resgates",
  "/comunidades/[slug]/frases",
  "/comunidades/[slug]/produtos",
  "/comunidades/[slug]/jogos",
  "/comunidades/[slug]/apostas",
  "/comunidades/[slug]/videos",
  "/comunidades/[slug]/inspiracoes",
  "/comunidades/[slug]/mensagens",
  "/comunidades/[slug]/integracao",
  "/c/[creatorSlug]",
  "/c/[creatorSlug]/quotes",
  "/c/[creatorSlug]/moeda",
  "/c/[creatorSlug]/ranking",
  "/c/[creatorSlug]/resgates",
  "/c/[creatorSlug]/produtinhos",
  "/c/[creatorSlug]/jogos",
  "/c/[creatorSlug]/apostas",
  "/c/[creatorSlug]/videos",
  "/c/[creatorSlug]/inspiracoes",
  "/obs/bets",
  "/obs/likes",
  "/obs/quotes",
  "/obs/subscribers",
  "/obs/stickers",
  "/obs/wheel",
]);

const expectedApiRoutes = new Set([
  "/api/admin/periodic-messages",
  "/api/me/creator-area/[id]/periodic-messages",
  "/api/internal/streamerbot/periodic-messages",
  "/api/internal/streamerbot/redemptions",
  "/api/creators/[slug]/redeem",
  "/api/me/creator-area/[id]/catalog",
  "/api/me/creator-area/[id]/integration-operations",
  "/api/admin/recommendations/image",
  "/api/me/creator-area/[id]/recommendations/image",
  "/api/me/creator-area/[id]/recommendations",
  "/api/me/creator-area/[id]/profile",
  "/api/me/creator-area/[id]/modules",
  "/api/me/creator-area/[id]/videos",
  "/api/c/[creatorSlug]/videos",
  "/api/c/[creatorSlug]/videos/[id]/vote",
  "/api/c/[creatorSlug]/videos/[id]/boost",
  "/api/c/[creatorSlug]/inspirations/[id]/boost",
  "/api/c/[creatorSlug]/games/[id]/boost",
  "/api/me/creator-area/[id]/inspirations",
  "/api/c/[creatorSlug]/inspirations",
  "/api/c/[creatorSlug]/inspirations/[id]/vote",
  "/api/me/creator-area/[id]/games",
  "/api/me/creator-area/[id]/page-rewards",
  "/api/c/[creatorSlug]/presence",
  "/api/c/[creatorSlug]/bets/[id]",
  "/api/me/creator-area/[id]/bets",
  "/api/c/[creatorSlug]/games",
  "/api/c/[creatorSlug]/games/search",
  "/api/c/[creatorSlug]/games/[id]/vote",
  "/api/me/creator-area/[id]/quotes",
  "/api/c/[creatorSlug]/ranking",
  "/api/admin/bets",
  "/api/admin/bets/[id]/cancel",
  "/api/admin/bets/[id]/lock",
  "/api/admin/bets/[id]/resolve",
  "/api/admin/bridge-status",
  "/api/admin/catalog",
  "/api/admin/catalog/[id]",
  "/api/admin/creator-area-access",
  "/api/admin/creator-area-access/requests",
  "/api/admin/creator-area-access/requests/[id]",
  "/api/me/creator-area-access",
  "/api/admin/creator-suggestions",
  "/api/admin/creator-suggestions/[id]",
  "/api/admin/current-game",
  "/api/admin/death-counter-game",
  "/api/admin/death-counters",
  "/api/admin/game-suggestions",
  "/api/admin/game-suggestions/boost-settings",
  "/api/admin/game-suggestions/[id]",
  "/api/admin/live-like-goals",
  "/api/admin/live-like-goals/[id]",
  "/api/admin/live-status",
  "/api/admin/obs-overlays",
  "/api/admin/pipetz-pricing",
  "/api/admin/recommendations",
  "/api/admin/recommendations/[id]",
  "/api/admin/redemptions",
  "/api/admin/redemptions/[id]",
  "/api/admin/video-suggestions",
  "/api/admin/video-suggestions/[id]",
  "/api/admin/viewers/attach-channel",
  "/api/admin/viewers/link",
  "/api/admin/viewers/[id]/adjust-balance",
  "/api/admin/viewers/[id]/airdrop",
  "/api/admin/wheel",
  "/api/admin/wheel/spin",
  "/api/auth/[...nextauth]",
  "/api/bets",
  "/api/catalog",
  "/api/games/search",
  "/api/health/public",
  "/api/internal/bridge/heartbeat",
  "/api/internal/bridge/pull",
  "/api/internal/bridge/[redemptionId]/claim",
  "/api/internal/bridge/[redemptionId]/complete",
  "/api/internal/bridge/[redemptionId]/fail",
  "/api/internal/google/cross-account-protection",
  "/api/internal/ps-plus/sync",
  "/api/internal/steam/sync",
  "/api/internal/streamerbot/bets/place",
  "/api/internal/streamerbot/counters",
  "/api/internal/streamerbot/credentials/check",
  "/api/internal/streamerbot/deaths",
  "/api/internal/streamerbot/events",
  "/api/internal/streamerbot/stickers",
  "/api/internal/streamerbot/economy",
  "/api/internal/streamerbot/chat-rewards",
  "/api/internal/streamerbot/link",
  "/api/internal/streamerbot/points",
  "/api/internal/streamerbot/quotes",
  "/api/internal/streamerbot/wheel",
  "/api/leaderboard",
  "/api/me",
  "/api/me/balance",
  "/api/me/bets/[betId]",
  "/api/me/creator-area",
  "/api/me/creator-area/[id]/currency",
  "/api/me/creator-area/[id]/economy",
  "/api/me/creator-area/[id]/chat-rewards",
  "/api/me/creator-area/[id]/streamerbot-credentials",
  "/api/me/creator-area/[id]/setup",
  "/api/me/creator-suggestions",
  "/api/me/creator-suggestions/[id]/boost",
  "/api/me/game-suggestions",
  "/api/me/game-suggestions/[id]/boost",
  "/api/me/link-code",
  "/api/me/quotes/[quoteId]/show",
  "/api/me/redeem",
  "/api/me/redemptions",
  "/api/me/video-suggestions",
  "/api/me/video-suggestions/[id]/boost",
  "/api/obs/bets/current",
  "/api/obs/likes/current",
  "/api/obs/live-status",
  "/api/obs/quotes/current",
  "/api/obs/subscribers/current",
  "/api/obs/stickers/current",
  "/api/obs/wheel/current",
  "/api/owner/creators/[id]",
  "/api/owner/creators/[id]/modules/[moduleKey]",
  "/api/owner/creators/[id]/streamerbot-credentials",
  "/api/recommendations",
  "/api/viewers",
  "/api/viewers/[youtubeChannelId]",
]);

async function collectRouteFiles(directory: string, suffix: "page.tsx" | "route.ts") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectRouteFiles(entryPath, suffix)));
    } else if (entry.isFile() && entry.name === suffix) {
      files.push(entryPath);
    }
  }

  return files;
}

function routeFromFile(filePath: string, suffix: "page.tsx" | "route.ts") {
  const relativePath = path.relative(appDirectory, filePath).replaceAll(path.sep, "/");
  const segments = relativePath
    .split("/")
    .slice(0, -1)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
  const route = `/${segments.join("/")}`;

  return route === "/" && suffix === "route.ts" ? "/" : route;
}

function expectRouteSet(actualRoutes: string[], expectedRoutes: Set<string>) {
  const duplicates = actualRoutes.filter((route, index) => actualRoutes.indexOf(route) !== index);
  expect(duplicates, "route URLs must not be duplicated").toEqual([]);
  expect(new Set(actualRoutes)).toEqual(expectedRoutes);
}

describe("application route map", () => {
  it("preserves the complete page URL inventory", async () => {
    const files = await collectRouteFiles(appDirectory, "page.tsx");
    expectRouteSet(
      files.map((filePath) => routeFromFile(filePath, "page.tsx")),
      expectedPageRoutes,
    );
  });

  it("preserves the complete API URL inventory", async () => {
    const files = await collectRouteFiles(appDirectory, "route.ts");
    expectRouteSet(
      files.map((filePath) => routeFromFile(filePath, "route.ts")),
      expectedApiRoutes,
    );
  });
});
