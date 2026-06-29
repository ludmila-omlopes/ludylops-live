import type { CreatorModuleRecord } from "@/lib/types";

export type CreatorModuleKey =
  | "points"
  | "redemptions"
  | "bets"
  | "ranking"
  | "product_recommendations"
  | "game_suggestions"
  | "video_suggestions"
  | "creator_suggestions"
  | "quotes"
  | "obs_overlays"
  | "streamerbot";

export type CreatorModuleManifest = {
  key: CreatorModuleKey;
  label: string;
  publicRoutes: string[];
  adminPanels: string[];
  obsRoutes: string[];
  requiredCapabilities: CreatorModuleKey[];
  defaultConfig: Record<string, unknown>;
};

export type CreatorModuleNavItem = {
  key: CreatorModuleKey;
  label: string;
  href: string;
};

export const creatorModuleCatalog = [
  {
    key: "points",
    label: "Pipetz",
    publicRoutes: ["/me"],
    adminPanels: ["pipetz-pricing", "pipetz-airdrop"],
    obsRoutes: [],
    requiredCapabilities: [],
    defaultConfig: {
      currencyLabel: "pipetz",
    },
  },
  {
    key: "ranking",
    label: "Ranking",
    publicRoutes: ["/ranking"],
    adminPanels: [],
    obsRoutes: [],
    requiredCapabilities: ["points"],
    defaultConfig: {},
  },
  {
    key: "redemptions",
    label: "Resgates",
    publicRoutes: ["/"],
    adminPanels: ["catalog"],
    obsRoutes: [],
    requiredCapabilities: ["points", "streamerbot"],
    defaultConfig: {},
  },
  {
    key: "bets",
    label: "Apostas",
    publicRoutes: ["/apostas"],
    adminPanels: ["bets"],
    obsRoutes: ["/obs/bets"],
    requiredCapabilities: ["points", "streamerbot"],
    defaultConfig: {
      minBet: 10,
      maxOptions: 6,
    },
  },
  {
    key: "product_recommendations",
    label: "Produtinhos",
    publicRoutes: ["/produtinhos"],
    adminPanels: ["product-recommendations"],
    obsRoutes: [],
    requiredCapabilities: [],
    defaultConfig: {},
  },
  {
    key: "game_suggestions",
    label: "Jogos",
    publicRoutes: ["/jogos"],
    adminPanels: ["game-suggestions"],
    obsRoutes: [],
    requiredCapabilities: ["points"],
    defaultConfig: {},
  },
  {
    key: "video_suggestions",
    label: "Vídeos",
    publicRoutes: ["/videos"],
    adminPanels: ["video-suggestions"],
    obsRoutes: [],
    requiredCapabilities: ["points"],
    defaultConfig: {},
  },
  {
    key: "creator_suggestions",
    label: "Inspirações",
    publicRoutes: ["/indicacoes"],
    adminPanels: ["creator-suggestions"],
    obsRoutes: [],
    requiredCapabilities: ["points"],
    defaultConfig: {},
  },
  {
    key: "quotes",
    label: "Quotes",
    publicRoutes: ["/quotes"],
    adminPanels: ["quotes"],
    obsRoutes: ["/obs/quote"],
    requiredCapabilities: ["points", "streamerbot", "obs_overlays"],
    defaultConfig: {
      displayDurationSeconds: 12,
    },
  },
  {
    key: "obs_overlays",
    label: "Overlays OBS",
    publicRoutes: [],
    adminPanels: ["obs-overlays"],
    obsRoutes: ["/obs/bets", "/obs/likes", "/obs/quote", "/obs/subscriber-alert"],
    requiredCapabilities: ["streamerbot"],
    defaultConfig: {},
  },
  {
    key: "streamerbot",
    label: "Streamer.bot",
    publicRoutes: ["/contadores"],
    adminPanels: ["streamerbot-scripts", "death-counter-game"],
    obsRoutes: [],
    requiredCapabilities: [],
    defaultConfig: {},
  },
] as const satisfies readonly CreatorModuleManifest[];

export const defaultCreatorModuleKeys = creatorModuleCatalog.map((module) => module.key);

export function getCreatorModuleManifest(moduleKey: string) {
  return creatorModuleCatalog.find((module) => module.key === moduleKey) ?? null;
}

export function isKnownCreatorModuleKey(moduleKey: string): moduleKey is CreatorModuleKey {
  return getCreatorModuleManifest(moduleKey) !== null;
}

export function getEnabledCreatorModules(modules: CreatorModuleRecord[]) {
  return modules.filter((module) => module.status === "installed" && isKnownCreatorModuleKey(module.moduleKey));
}

export function getEnabledModuleNav(modules: CreatorModuleRecord[]): CreatorModuleNavItem[] {
  const navItems: CreatorModuleNavItem[] = [];

  for (const module of getEnabledCreatorModules(modules)) {
    const manifest = getCreatorModuleManifest(module.moduleKey);
    const href = manifest?.publicRoutes[0];
    if (!manifest || !href) {
      continue;
    }

    navItems.push({
      key: manifest.key,
      label: manifest.label,
      href,
    });
  }

  return navItems;
}
