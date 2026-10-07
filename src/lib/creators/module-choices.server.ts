import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { creatorModules, creators } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import type { CreatorModuleRecord } from "@/lib/types";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import { describeModuleChoices, moduleChoicesInputSchema, planModuleChoices, turnsOnAloneWith, type ModuleChoiceKey, type ModuleChoicePlan } from "./module-choices";
import { communityEconomyEnabled } from "./economy-switch";
import { getCreatorModuleManifest } from "./modules";

const turnsOnAlone = () => turnsOnAloneWith(communityEconomyEnabled());

export class ModuleChoicesAccessError extends Error {
  constructor() { super("Módulos indisponíveis para esta comunidade."); }
}

function assertIdentity(ownerUserId: string, creatorId: string) {
  // Ludylops keeps its modules under the platform console.
  if (!ownerUserId || !creatorId || creatorId === DEFAULT_CREATOR_ID) throw new ModuleChoicesAccessError();
}

function demoTenant(ownerUserId: string, creatorId: string) {
  const tenant = listDemoCreatorTenants().find((entry) => entry.creator.id === creatorId
    && entry.creator.ownerUserId === ownerUserId && entry.creator.status === "active");
  if (!tenant) throw new ModuleChoicesAccessError();
  return tenant;
}

const statusOf = (plan: ModuleChoicePlan, key: ModuleChoiceKey) => (plan.install.includes(key) ? "installed" : "requested");

function applyDemoPlan(modules: CreatorModuleRecord[], creatorId: string, plan: ModuleChoicePlan, chosenAt: string) {
  const kept = modules.filter((module) => !plan.remove.some((key) => key === module.moduleKey));
  for (const key of [...plan.install, ...plan.request, ...plan.keep]) {
    const existing = kept.find((module) => module.moduleKey === key);
    if (existing) {
      if (!plan.keep.includes(key)) existing.status = statusOf(plan, key);
      existing.configJson = { ...existing.configJson, chosenAt };
      existing.updatedAt = chosenAt;
    } else {
      kept.push({
        id: `${creatorId}_${key}`.slice(0, 64),
        creatorId,
        moduleKey: key,
        status: statusOf(plan, key),
        configJson: { ...structuredClone(getCreatorModuleManifest(key)!.defaultConfig), chosenAt },
        installedAt: chosenAt,
        updatedAt: chosenAt,
      });
    }
  }
  return kept;
}

/** ownerUserId must come from the authenticated session, never the request body. */
export async function getOwnedModuleChoices(ownerUserId: string, creatorId: string) {
  assertIdentity(ownerUserId, creatorId);
  if (isDemoMode) return describeModuleChoices(demoTenant(ownerUserId, creatorId).modules, turnsOnAlone());
  const db = getDb();
  if (!db) throw new Error("module_choices_unavailable");
  const [creator] = await db.select({ id: creators.id }).from(creators)
    .where(and(eq(creators.id, creatorId), eq(creators.ownerUserId, ownerUserId), eq(creators.status, "active")));
  if (!creator) throw new ModuleChoicesAccessError();
  const rows = await db.select({ moduleKey: creatorModules.moduleKey, status: creatorModules.status })
    .from(creatorModules).where(eq(creatorModules.creatorId, creatorId));
  return describeModuleChoices(rows, turnsOnAlone());
}

export async function updateOwnedModuleChoices(ownerUserId: string, creatorId: string, input: unknown) {
  assertIdentity(ownerUserId, creatorId);
  const { modules: chosen } = moduleChoicesInputSchema.parse(input);
  const chosenAt = new Date().toISOString();
  if (isDemoMode) {
    const tenant = demoTenant(ownerUserId, creatorId);
    tenant.modules = applyDemoPlan(tenant.modules, creatorId, planModuleChoices(tenant.modules, chosen, turnsOnAlone()), chosenAt);
    return describeModuleChoices(tenant.modules, turnsOnAlone());
  }
  const db = getDb();
  if (!db) throw new Error("module_choices_unavailable");
  return db.transaction(async (tx) => {
    // Same lock as the platform console, so module changes for one community never interleave.
    const [creator] = await tx.select({ id: creators.id }).from(creators)
      .where(and(eq(creators.id, creatorId), eq(creators.ownerUserId, ownerUserId), eq(creators.status, "active")))
      .for("update");
    if (!creator) throw new ModuleChoicesAccessError();
    const rows = await tx.select({ moduleKey: creatorModules.moduleKey, status: creatorModules.status })
      .from(creatorModules).where(eq(creatorModules.creatorId, creatorId));
    const plan = planModuleChoices(rows, chosen, turnsOnAlone());
    const now = new Date(chosenAt);
    const stamp = sql`${creatorModules.configJson} || ${JSON.stringify({ chosenAt })}::jsonb`;

    if (plan.remove.length) {
      await tx.delete(creatorModules).where(and(eq(creatorModules.creatorId, creatorId),
        inArray(creatorModules.moduleKey, plan.remove), inArray(creatorModules.status, ["installed", "requested"])));
    }
    for (const key of [...plan.install, ...plan.request]) {
      const status = statusOf(plan, key);
      await tx.insert(creatorModules).values({
        id: `creator_module_${randomUUID()}`.slice(0, 64),
        creatorId,
        moduleKey: key,
        status,
        configJson: { ...getCreatorModuleManifest(key)!.defaultConfig, chosenAt },
        installedAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [creatorModules.creatorId, creatorModules.moduleKey],
        set: { status, configJson: stamp, updatedAt: now },
      });
    }
    if (plan.keep.length) {
      await tx.update(creatorModules).set({ configJson: stamp, updatedAt: now })
        .where(and(eq(creatorModules.creatorId, creatorId), inArray(creatorModules.moduleKey, plan.keep)));
    }

    const next = await tx.select({ moduleKey: creatorModules.moduleKey, status: creatorModules.status })
      .from(creatorModules).where(eq(creatorModules.creatorId, creatorId));
    return describeModuleChoices(next, turnsOnAlone());
  });
}
