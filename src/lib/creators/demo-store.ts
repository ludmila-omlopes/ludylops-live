import { DEFAULT_CREATOR_DOMAIN, DEFAULT_CREATOR_MODULES } from "@/lib/creators/defaults";
import type { CreatorTenantRecord } from "@/lib/types";

declare global {
  var __creatorTenantStore: CreatorTenantRecord[] | undefined;
}

function getStore() {
  if (!globalThis.__creatorTenantStore) {
    globalThis.__creatorTenantStore = [];
  }
  return globalThis.__creatorTenantStore;
}

export function listDemoCreatorTenants() {
  return getStore();
}

export function findDemoCreatorTenantBySlug(slug: string) {
  return getStore().find((tenant) => tenant.creator.slug === slug) ?? null;
}

export function findDemoCreatorTenantByHostname(hostname: string) {
  return (
    getStore().find((tenant) => tenant.domains.some((domain) => domain.hostname === hostname)) ??
    findDemoCreatorTenantBySlug(hostname.endsWith(`.${DEFAULT_CREATOR_DOMAIN}`) ? hostname.slice(0, -DEFAULT_CREATOR_DOMAIN.length - 1) : "")
  );
}

export function findDemoCreatorTenantsByOwner(ownerUserId: string) {
  return getStore().filter((tenant) => tenant.creator.ownerUserId === ownerUserId);
}

export function insertDemoCreatorTenant(tenant: CreatorTenantRecord) {
  const store = getStore();
  if (store.some((entry) => entry.creator.slug === tenant.creator.slug)) {
    throw new Error("creator_slug_exists");
  }
  store.push(tenant);
  return tenant;
}

export function buildDemoCreatorModules(creatorId: string) {
  return DEFAULT_CREATOR_MODULES.map((module) => ({
    ...module,
    id: `${creatorId}_${module.moduleKey}`.slice(0, 64),
    creatorId,
  }));
}
