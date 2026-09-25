import { and, count, eq, gt, isNull, max, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creators, creatorModules, streamerbotCredentials as credentials, creatorCatalogItems as catalog, creatorRedemptions as redemptions } from "@/lib/db/schema";
import { env, isDemoMode } from "@/lib/env";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import { buildCreatorSetup } from "./setup";
import { modulesAreAvailable } from "./module-access";

export class SetupAccessError extends Error {}
export async function getOwnedCreatorSetup(viewerId: string, creatorId: string) {
  if (!viewerId || !creatorId || creatorId === DEFAULT_CREATOR_ID) throw new SetupAccessError();
  if (isDemoMode) {
    const tenant = listDemoCreatorTenants().find(t => t.creator.id === creatorId && t.creator.ownerUserId === viewerId);
    if (!tenant) throw new SetupAccessError();
    const items = globalThis.__creatorRedemptionsDemo?.items.filter(i => i.creatorId === creatorId) ?? [];
    const entries = globalThis.__creatorRedemptionsDemo?.entries.filter(e => e.creatorId === creatorId && e.status === "completed") ?? [];
    return buildCreatorSetup({ ...tenant, economyEnabled: true, credentials: null, catalog: { total: items.length, available: items.filter(i => i.isActive && (i.stock === null || i.stock > 0)).length, completed: entries.length } });
  }
  const db = getDb(); if (!db) throw new Error("setup_unavailable");
  return db.transaction(async tx => {
    const [creator] = await tx.select().from(creators).where(and(eq(creators.id, creatorId), eq(creators.ownerUserId, viewerId))).for("share");
    if (!creator) throw new SetupAccessError();
    const modules = await tx.select().from(creatorModules).where(eq(creatorModules.creatorId, creatorId)).for("share");
    const [credential] = await tx.select({ usable: count(), lastUsedAt: max(credentials.lastUsedAt) }).from(credentials).where(and(eq(credentials.creatorId, creatorId), isNull(credentials.revokedAt), or(eq(credentials.status, "active"), and(eq(credentials.status, "retiring"), gt(credentials.retiringUntil, new Date())))));
    const economyEnabled = env.CREATOR_ECONOMY_ENABLED === "true";
    let catalogState = null;
    if (economyEnabled && modulesAreAvailable({ creator, modules }, ["redemptions"])) {
      const [items] = await tx.select({ total: count(), available: sql<number>`count(*) filter (where ${catalog.isActive} and (${catalog.stock} is null or ${catalog.stock} > 0))::int` }).from(catalog).where(eq(catalog.creatorId, creatorId));
      const [completed] = await tx.select({ count: count() }).from(redemptions).where(and(eq(redemptions.creatorId, creatorId), eq(redemptions.status, "completed")));
      catalogState = { ...items, completed: completed.count };
    }
    return buildCreatorSetup({ creator, modules, economyEnabled, credentials: { ...credential, lastUsedAt: credential.lastUsedAt ? new Date(credential.lastUsedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) + " (Brasília)" : null }, catalog: catalogState });
  });
}
