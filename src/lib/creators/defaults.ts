import type { CreatorBrandingRecord, CreatorDomainRecord, CreatorModuleRecord, CreatorRecord } from "@/lib/types";

import { creatorModuleCatalog } from "@/lib/creators/modules";

export const DEFAULT_CREATOR_ID = "creator_ludylops";
export const DEFAULT_CREATOR_SLUG = "ludylops";
export const DEFAULT_CREATOR_DISPLAY_NAME = "Ludylops";
export const DEFAULT_CREATOR_DOMAIN = "ludylops.live";

export const DEFAULT_CREATOR: CreatorRecord = {
  id: DEFAULT_CREATOR_ID,
  slug: DEFAULT_CREATOR_SLUG,
  displayName: DEFAULT_CREATOR_DISPLAY_NAME,
  ownerUserId: null,
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export const DEFAULT_CREATOR_BRANDING: CreatorBrandingRecord = {
  creatorId: DEFAULT_CREATOR_ID,
  logoUrl: null,
  avatarUrl: null,
  primaryColor: "#c7a2e9",
  secondaryColor: "#ff79c6",
  backgroundColor: "#f9f9f9",
  accentColor: "#40a9ff",
  fontHeading: "app-display",
  fontBody: "app-body",
  borderRadius: 0,
  themeJson: {},
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export const DEFAULT_CREATOR_DOMAINS: CreatorDomainRecord[] = [
  {
    id: "creator_domain_ludylops_live",
    creatorId: DEFAULT_CREATOR_ID,
    hostname: DEFAULT_CREATOR_DOMAIN,
    isPrimary: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

export const DEFAULT_CREATOR_MODULES: CreatorModuleRecord[] = creatorModuleCatalog.map((module) => ({
  id: `creator_module_ludylops_${module.key}`,
  creatorId: DEFAULT_CREATOR_ID,
  moduleKey: module.key,
  status: "installed",
  configJson: module.defaultConfig,
  installedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}));
