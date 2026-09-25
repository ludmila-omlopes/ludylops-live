import { randomUUID } from "node:crypto";

import { asc, eq, inArray } from "drizzle-orm";

import { DEFAULT_CREATOR_ID, DEFAULT_CREATOR_MODULES } from "@/lib/creators/defaults";
import {
  creatorModuleCatalog,
  getCreatorModuleManifest,
} from "@/lib/creators/modules";
import { defaultCreatorTenant } from "@/lib/creators/tenant";
import { listDemoCreatorTenants } from "./demo-store";
import { planModuleTransition } from "./module-policy";
import { creatorPlatformUrl } from "./platform";
import { getDb } from "@/lib/db/client";
import {
  creatorBranding,
  creatorDomains,
  creatorModules,
  creators,
  users,
} from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import type {
  CreatorBrandingRecord,
  CreatorDomainRecord,
  CreatorModuleRecord,
  CreatorModuleStatus,
  CreatorRecord,
  CreatorStatus,
  PlatformCreatorInstanceRecord,
} from "@/lib/types";

const creatorStatuses = [
  "active",
  "disabled",
  "archived",
] as const satisfies readonly CreatorStatus[];
const creatorModuleStatuses = [
  "installed",
  "disabled",
  "archived",
] as const satisfies readonly CreatorModuleStatus[];

function toIsoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function serializeCreator(row: typeof creators.$inferSelect): CreatorRecord {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    ownerUserId: row.ownerUserId,
    status: row.status as CreatorStatus,
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
  };
}

function serializeCreatorBranding(
  row: typeof creatorBranding.$inferSelect,
): CreatorBrandingRecord {
  return {
    creatorId: row.creatorId,
    logoUrl: row.logoUrl,
    avatarUrl: row.avatarUrl,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    backgroundColor: row.backgroundColor,
    accentColor: row.accentColor,
    fontHeading: row.fontHeading,
    fontBody: row.fontBody,
    borderRadius: row.borderRadius,
    themeJson: row.themeJson as Record<string, unknown>,
    updatedAt: toIsoDate(row.updatedAt),
  };
}

function serializeCreatorDomain(
  row: typeof creatorDomains.$inferSelect,
): CreatorDomainRecord {
  return {
    id: row.id,
    creatorId: row.creatorId,
    hostname: row.hostname,
    isPrimary: row.isPrimary,
    createdAt: toIsoDate(row.createdAt),
  };
}

function serializeCreatorModule(
  row: typeof creatorModules.$inferSelect,
): CreatorModuleRecord {
  return {
    id: row.id,
    creatorId: row.creatorId,
    moduleKey: row.moduleKey,
    status: row.status as CreatorModuleStatus,
    configJson: row.configJson as Record<string, unknown>,
    installedAt: toIsoDate(row.installedAt),
    updatedAt: toIsoDate(row.updatedAt),
  };
}

function moduleSummary(modules: CreatorModuleRecord[]) {
  return {
    available: creatorModuleCatalog.length,
    installed: modules.filter((module) => module.status === "installed").length,
    disabled: modules.filter((module) => module.status === "disabled").length,
    archived: modules.filter((module) => module.status === "archived").length,
  };
}

function primaryDomain(domains: CreatorDomainRecord[]) {
  return (
    domains.find((domain) => domain.isPrimary)?.hostname ??
    domains[0]?.hostname ??
    null
  );
}

function publicUrlForDomain(hostname: string | null) {
  return hostname ? `https://${hostname}` : null;
}

function buildInstance(input: {
  creator: CreatorRecord;
  owner: PlatformCreatorInstanceRecord["owner"];
  branding: CreatorBrandingRecord | null;
  domains: CreatorDomainRecord[];
  modules: CreatorModuleRecord[];
}): PlatformCreatorInstanceRecord {
  const isDefaultCreator = input.creator.id === DEFAULT_CREATOR_ID;
  const branding =
    input.branding ??
    (isDefaultCreator
      ? defaultCreatorTenant.branding
      : {
          ...defaultCreatorTenant.branding,
          creatorId: input.creator.id,
        });
  const domains =
    input.domains.length > 0
      ? input.domains
      : isDefaultCreator
        ? defaultCreatorTenant.domains
        : [];
  const modules = input.modules;
  const domain = primaryDomain(domains);

  return {
    creator: input.creator,
    owner: input.owner,
    branding,
    domains,
    modules,
    primaryDomain: domain,
    publicUrl: publicUrlForDomain(domain) ?? creatorPlatformUrl(input.creator.slug),
    moduleSummary: moduleSummary(modules),
  };
}

export function isCreatorStatus(value: string): value is CreatorStatus {
  return creatorStatuses.includes(value as CreatorStatus);
}

export function isCreatorModuleStatus(
  value: string,
): value is CreatorModuleStatus {
  return creatorModuleStatuses.includes(value as CreatorModuleStatus);
}

export async function listPlatformCreatorInstances(): Promise<
  PlatformCreatorInstanceRecord[]
> {
  const db = getDb();
  if (isDemoMode) {
    return [
      defaultCreatorTenant,
      ...listDemoCreatorTenants().filter(
        (entry) => entry.creator.id !== DEFAULT_CREATOR_ID,
      ),
    ].map((tenant) => buildInstance({ ...tenant, owner: null }));
  }
  if (!db) throw new Error("module_policy_unavailable");

  const creatorRows = await db
    .select({
      id: creators.id,
      slug: creators.slug,
      displayName: creators.displayName,
      ownerUserId: creators.ownerUserId,
      status: creators.status,
      createdAt: creators.createdAt,
      updatedAt: creators.updatedAt,
      ownerEmail: users.email,
      ownerYoutubeDisplayName: users.youtubeDisplayName,
      ownerYoutubeHandle: users.youtubeHandle,
      ownerAvatarUrl: users.avatarUrl,
    })
    .from(creators)
    .leftJoin(users, eq(creators.ownerUserId, users.id))
    .orderBy(asc(creators.displayName));

  if (creatorRows.length === 0) {
    return [];
  }

  const creatorIds = creatorRows.map((row) => row.id);
  const [domainRows, brandingRows, moduleRows] = await Promise.all([
    db
      .select()
      .from(creatorDomains)
      .where(inArray(creatorDomains.creatorId, creatorIds)),
    db
      .select()
      .from(creatorBranding)
      .where(inArray(creatorBranding.creatorId, creatorIds)),
    db
      .select()
      .from(creatorModules)
      .where(inArray(creatorModules.creatorId, creatorIds)),
  ]);

  return creatorRows.map((row) => {
    const creator = serializeCreator(row);
    const domains = domainRows
      .filter((domain) => domain.creatorId === creator.id)
      .map(serializeCreatorDomain)
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
    const modules = moduleRows
      .filter((module) => module.creatorId === creator.id)
      .map(serializeCreatorModule);
    const branding = brandingRows.find(
      (entry) => entry.creatorId === creator.id,
    );

    return buildInstance({
      creator,
      owner: row.ownerUserId
        ? {
            id: row.ownerUserId,
            email: row.ownerEmail,
            youtubeDisplayName:
              row.ownerYoutubeDisplayName ?? row.ownerEmail ?? "Sem nome",
            youtubeHandle: row.ownerYoutubeHandle,
            avatarUrl: row.ownerAvatarUrl,
          }
        : null,
      branding: branding ? serializeCreatorBranding(branding) : null,
      domains,
      modules,
    });
  });
}

export async function updatePlatformCreatorStatus(input: {
  creatorId: string;
  status: CreatorStatus;
}) {
  const db = getDb();
  if (isDemoMode) {
    const tenant =
      listDemoCreatorTenants().find(
        (entry) => entry.creator.id === input.creatorId,
      ) ??
      (input.creatorId === DEFAULT_CREATOR_ID ? defaultCreatorTenant : null);
    if (!tenant) return null;
    tenant.creator = {
      ...tenant.creator,
      status: input.status,
      updatedAt: new Date().toISOString(),
    };
    return tenant.creator;
  }
  if (!db) throw new Error("module_policy_unavailable");

  const [updated] = await db
    .update(creators)
    .set({
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(creators.id, input.creatorId))
    .returning();

  return updated ? serializeCreator(updated) : null;
}

export async function updatePlatformCreatorModuleStatus(input: {
  creatorId: string;
  moduleKey: string;
  status: CreatorModuleStatus;
}) {
  const manifest = getCreatorModuleManifest(input.moduleKey);
  if (!manifest) {
    return null;
  }

  const defaultConfig = input.creatorId === DEFAULT_CREATOR_ID
    ? DEFAULT_CREATOR_MODULES.find((entry) => entry.moduleKey === manifest.key)!.configJson
    : manifest.defaultConfig;

  const db = getDb();
  if (isDemoMode) {
    const tenant =
      listDemoCreatorTenants().find(
        (entry) => entry.creator.id === input.creatorId,
      ) ??
      (input.creatorId === DEFAULT_CREATOR_ID ? defaultCreatorTenant : null);
    if (!tenant) return null;
    assertModuleTransition(tenant.modules, manifest.key, input.status);
    const existing = tenant.modules.find(
      (entry) => entry.moduleKey === manifest.key,
    );
    const updated = {
      ...existing,
      id: existing?.id ?? randomUUID(),
      creatorId: input.creatorId,
      moduleKey: manifest.key,
      status: input.status,
      configJson: existing?.configJson ?? defaultConfig,
      installedAt: existing?.installedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tenant.modules = [
      ...tenant.modules.filter((entry) => entry.moduleKey !== manifest.key),
      updated,
    ];
    return updated;
  }
  if (!db) throw new Error("module_policy_unavailable");

  return db.transaction(async (tx) => {
    const [creator] = await tx
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.id, input.creatorId))
      .for("update");
    if (!creator) return null;
    const current = await tx
      .select()
      .from(creatorModules)
      .where(eq(creatorModules.creatorId, input.creatorId));
    assertModuleTransition(current, manifest.key, input.status);
    const now = new Date();
    const [updated] = await tx
      .insert(creatorModules)
      .values({
        id: randomUUID(),
        creatorId: input.creatorId,
        moduleKey: manifest.key,
        status: input.status,
        configJson: defaultConfig,
        installedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [creatorModules.creatorId, creatorModules.moduleKey],
        set: {
          status: input.status,
          updatedAt: now,
        },
      })
      .returning();

    return updated ? serializeCreatorModule(updated) : null;
  });
}

export class ModuleTransitionError extends Error {
  constructor(
    public readonly details: ReturnType<typeof planModuleTransition>,
  ) {
    const labels = details.blocking
      .map((key) => getCreatorModuleManifest(key)?.label ?? key)
      .join(", ");
    super(
      details.kind === "missing_dependencies"
        ? `Ative primeiro: ${labels}.`
        : `Desative primeiro os recursos dependentes: ${labels}.`,
    );
  }
}

function assertModuleTransition(
  rows: { moduleKey: string; status: string }[],
  key: string,
  status: string,
) {
  const plan = planModuleTransition(creatorModuleCatalog, rows, key, status);
  if (!plan.allowed) throw new ModuleTransitionError(plan);
}
