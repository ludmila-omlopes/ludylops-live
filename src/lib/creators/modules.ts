import type { CreatorModuleRecord } from "@/lib/types";
import { moduleAvailability, validateModuleCatalog } from "./module-policy";
import { modulePages } from "./module-entry-points";

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
    adminPanels: ["precos", "airdrop", "vinculos", "metas-likes"],
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
    adminPanels: ["ranking"],
    obsRoutes: [],
    requiredCapabilities: ["points"],
    defaultConfig: {},
  },
  {
    key: "redemptions",
    label: "Resgates",
    publicRoutes: [],
    adminPanels: ["catalogo", "fila-resgates"],
    obsRoutes: [],
    requiredCapabilities: ["points", "streamerbot"],
    defaultConfig: {},
  },
  {
    key: "bets",
    label: "Apostas",
    publicRoutes: ["/apostas"],
    adminPanels: ["apostas-live"],
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
    adminPanels: ["produtos"],
    obsRoutes: [],
    requiredCapabilities: [],
    defaultConfig: {},
  },
  {
    key: "game_suggestions",
    label: "Jogos",
    publicRoutes: ["/jogos"],
    adminPanels: ["sugestoes-jogos"],
    obsRoutes: [],
    requiredCapabilities: ["points"],
    defaultConfig: {},
  },
  {
    key: "video_suggestions",
    label: "Vídeos",
    publicRoutes: ["/videos"],
    adminPanels: ["videos"],
    obsRoutes: [],
    requiredCapabilities: ["points"],
    defaultConfig: {},
  },
  {
    key: "creator_suggestions",
    label: "Inspirações",
    publicRoutes: ["/indicacoes"],
    adminPanels: ["indicacoes-criadores"],
    obsRoutes: [],
    requiredCapabilities: ["points"],
    defaultConfig: {},
  },
  {
    key: "quotes",
    label: "Quotes",
    publicRoutes: ["/quotes"],
    adminPanels: ["overlays"],
    obsRoutes: ["/obs/quotes"],
    requiredCapabilities: ["points", "streamerbot", "obs_overlays"],
    defaultConfig: {
      displayDurationSeconds: 12,
    },
  },
  {
    key: "obs_overlays",
    label: "Overlays OBS",
    publicRoutes: [],
    adminPanels: ["overlays", "roleta", "metas-likes"],
    obsRoutes: ["/obs/bets", "/obs/likes", "/obs/quotes", "/obs/subscribers", "/obs/wheel"],
    requiredCapabilities: ["streamerbot"],
    defaultConfig: {},
  },
  {
    key: "streamerbot",
    label: "Streamer.bot",
    publicRoutes: ["/contadores"],
    adminPanels: ["streamerbot", "jogo-atual", "contadores-mortes", "status-live", "vinculos"],
    obsRoutes: [],
    requiredCapabilities: [],
    defaultConfig: {},
  },
] as const satisfies readonly CreatorModuleManifest[];

export const defaultCreatorModuleKeys = creatorModuleCatalog.map((module) => module.key);
validateModuleCatalog(creatorModuleCatalog);

export const getModuleAvailability = (modules: readonly { moduleKey: string; status: string }[], key: string) =>
  moduleAvailability(creatorModuleCatalog, modules, key);

export function getCreatorModuleManifest(moduleKey: string) {
  return creatorModuleCatalog.find((module) => module.key === moduleKey) ?? null;
}

export function isKnownCreatorModuleKey(moduleKey: string): moduleKey is CreatorModuleKey {
  return getCreatorModuleManifest(moduleKey) !== null;
}

export function getEnabledCreatorModules(modules: CreatorModuleRecord[]) {
  return modules.filter((module) => getModuleAvailability(modules, module.moduleKey).available);
}

export function getEnabledModuleNav(modules: CreatorModuleRecord[]): CreatorModuleNavItem[] {
  const navItems: CreatorModuleNavItem[] = [];

  for (const creatorModule of getEnabledCreatorModules(modules)) {
    const manifest = getCreatorModuleManifest(creatorModule.moduleKey);
    const href = manifest?.publicRoutes[0];
    if (!manifest || !href) {
      continue;
    }
    if (!modulePages[href]?.every(key => getModuleAvailability(modules, key).available)) continue;

    navItems.push({
      key: manifest.key,
      label: manifest.label,
      href,
    });
  }

  return navItems;
}
