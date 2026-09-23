import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creatorModules, creators } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import { CurrencyAccessError } from "./currency.server";
import { chatRewardSettingsSchema, getChatRewardSettings } from "./chat-rewards";

function identity(ownerId: string, creatorId: string) {
  if (!ownerId || !creatorId || creatorId === DEFAULT_CREATOR_ID) throw new CurrencyAccessError();
}
function demoModule(ownerId: string, creatorId: string) {
  const tenant = listDemoCreatorTenants().find((t) => t.creator.id === creatorId
    && t.creator.ownerUserId === ownerId && t.creator.status === "active");
  const points = tenant?.modules.find((m) => m.moduleKey === "points" && ["installed", "disabled"].includes(m.status));
  if (!points) throw new CurrencyAccessError();
  return points;
}
export async function getOwnedChatRewards(ownerId: string, creatorId: string) {
  identity(ownerId, creatorId);
  if (isDemoMode) return getChatRewardSettings(demoModule(ownerId, creatorId).configJson);
  const db = getDb();
  if (!db) throw new Error("economy_storage_unavailable");
  const [row] = await db.select({ config: creatorModules.configJson }).from(creators)
    .innerJoin(creatorModules, eq(creatorModules.creatorId, creators.id))
    .where(and(eq(creators.id, creatorId), eq(creators.ownerUserId, ownerId), eq(creators.status, "active"),
      eq(creatorModules.moduleKey, "points"), inArray(creatorModules.status, ["installed", "disabled"]))).limit(1);
  if (!row) throw new CurrencyAccessError();
  return getChatRewardSettings(row.config as Record<string, unknown>);
}
/** The owner ID must come from the authenticated session. */
export async function updateOwnedChatRewards(ownerId: string, creatorId: string, input: unknown) {
  identity(ownerId, creatorId);
  const chatRewards = chatRewardSettingsSchema.parse(input);
  if (isDemoMode) {
    const points = demoModule(ownerId, creatorId);
    points.configJson = { ...points.configJson, chatRewards };
    points.updatedAt = new Date().toISOString();
    return chatRewards;
  }
  const db = getDb();
  if (!db) throw new Error("economy_storage_unavailable");
  return db.transaction(async (tx) => {
    const [creator] = await tx.select({ id: creators.id }).from(creators)
      .where(and(eq(creators.id, creatorId), eq(creators.ownerUserId, ownerId), eq(creators.status, "active"))).for("update");
    if (!creator) throw new CurrencyAccessError();
    const [updated] = await tx.update(creatorModules).set({
      configJson: sql`${creatorModules.configJson} || ${JSON.stringify({ chatRewards })}::jsonb`, updatedAt: new Date(),
    }).where(and(eq(creatorModules.creatorId, creatorId), eq(creatorModules.moduleKey, "points"),
      inArray(creatorModules.status, ["installed", "disabled"]))).returning({ id: creatorModules.id });
    if (!updated) throw new CurrencyAccessError();
    return chatRewards;
  });
}
