import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creators, creatorModules, creatorBalances, creatorLedger, users } from "@/lib/db/schema";
import { env, isDemoMode } from "@/lib/env";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import { requireCreatorContext, type CreatorContext } from "./context";
import { getCurrencyLabel } from "./currency";
import { economyMutationSchema } from "./economy-input";
import { creditedEconomyViewer, lockEconomyIdentity, type EconomyTx } from "./economy-identity";
import { demoEconomyBalance, creditedDemoEconomyViewer, economyDemoStore, mutateDemoEconomy, sameOperation } from "./economy-demo";

export type EconomyAuthority = { kind: "viewer"; viewerId: string } | { kind: "owner"; viewerId: string } | { kind: "integration" };

function validateContext(context: CreatorContext) {
  if (!isDemoMode && env.CREATOR_ECONOMY_ENABLED !== "true") throw new Error("economy_unavailable");
  const id = requireCreatorContext(context);
  if (id === DEFAULT_CREATOR_ID) throw new Error("legacy_economy_only");
  return id;
}
async function authorize(tx: EconomyTx, creatorId: string, authority: EconomyAuthority) {
  const [creator] = await tx.select().from(creators).where(eq(creators.id, creatorId)).for("share");
  const [points] = await tx.select().from(creatorModules)
    .where(and(eq(creatorModules.creatorId, creatorId), eq(creatorModules.moduleKey, "points"))).for("share");
  if (!creator || creator.status !== "active" || points?.status !== "installed"
    || (authority.kind === "owner" && creator.ownerUserId !== authority.viewerId)) throw new Error("economy_unavailable");
  return getCurrencyLabel(points.configJson as Record<string, unknown>);
}
function authorizeDemo(creatorId: string, authority: EconomyAuthority) {
  const tenant = listDemoCreatorTenants().find((t) => t.creator.id === creatorId);
  const points = tenant?.modules.find((m) => m.moduleKey === "points");
  if (!tenant || tenant.creator.status !== "active" || points?.status !== "installed"
    || (authority.kind === "owner" && tenant.creator.ownerUserId !== authority.viewerId)) throw new Error("economy_unavailable");
  return getCurrencyLabel(points.configJson);
}

export async function assertCreatorEconomyAccess(context: CreatorContext, authority: EconomyAuthority) {
  const creatorId = validateContext(context);
  if (isDemoMode) return authorizeDemo(creatorId, authority);
  const db = getDb();
  if (!db) throw new Error("economy_storage_unavailable");
  return db.transaction((tx) => authorize(tx, creatorId, authority));
}

export async function readOwnedChannelEconomy(context: CreatorContext, ownerId: string, channelId: string) {
  const authority = { kind: "owner", viewerId: ownerId } as const;
  await assertCreatorEconomyAccess(context, authority);
  const db = getDb();
  const viewer = isDemoMode ? globalThis.__lojaDemoStore?.viewers.find((v) => v.youtubeChannelId === channelId)
    : (await db!.select({ id: users.id }).from(users).where(eq(users.youtubeChannelId, channelId)))[0];
  if (!viewer) throw new Error("viewer_not_found");
  return readCreatorEconomy(context, authority, viewer.id);
}

export async function readCreatorEconomy(context: CreatorContext, authority: EconomyAuthority, viewerId: string) {
  const creatorId = validateContext(context);
  if (!viewerId || (authority.kind === "viewer" && authority.viewerId !== viewerId)) throw new Error("economy_unavailable");
  if (isDemoMode) {
    const currencyLabel = authorizeDemo(creatorId, authority);
    const canonical = creditedDemoEconomyViewer(viewerId);
    return { currencyLabel, viewerId: canonical, balance: demoEconomyBalance(creatorId, canonical),
      entries: economyDemoStore().entries.filter((e) => e.creatorId === creatorId && e.viewerId === canonical).slice(0, 50) };
  }
  const db = getDb();
  if (!db) throw new Error("economy_storage_unavailable");
  return db.transaction(async (tx) => {
    await lockEconomyIdentity(tx);
    const currencyLabel = await authorize(tx, creatorId, authority);
    const canonical = await creditedEconomyViewer(tx, viewerId);
    const [balance] = await tx.select().from(creatorBalances)
      .where(and(eq(creatorBalances.creatorId, creatorId), eq(creatorBalances.viewerId, canonical)));
    const entries = await tx.select().from(creatorLedger)
      .where(and(eq(creatorLedger.creatorId, creatorId), eq(creatorLedger.viewerId, canonical)))
      .orderBy(desc(creatorLedger.createdAt), desc(creatorLedger.id)).limit(50);
    return { currencyLabel, viewerId: canonical,
      balance: { currentBalance: balance?.currentBalance ?? 0, lifetimeEarned: balance?.lifetimeEarned ?? 0, lifetimeSpent: balance?.lifetimeSpent ?? 0 }, entries };
  }, { isolationLevel: "repeatable read" });
}

/** Integration authority must originate from verified credentials, never a request field. */
export async function mutateCreatorEconomy(context: CreatorContext, authority: EconomyAuthority, input: unknown) {
  const creatorId = validateContext(context);
  if (authority.kind === "viewer") throw new Error("economy_unavailable");
  const parsed = economyMutationSchema.parse(input);
  if (isDemoMode) {
    const currencyLabel = authorizeDemo(creatorId, authority);
    const viewerId = creditedDemoEconomyViewer(parsed.viewerId);
    if (!globalThis.__lojaDemoStore?.viewers.some((v) => v.id === viewerId)) throw new Error("viewer_not_found");
    return { ...mutateDemoEconomy(creatorId, parsed), currencyLabel };
  }
  const db = getDb();
  if (!db) throw new Error("economy_storage_unavailable");
  return db.transaction(async (tx) => {
    await lockEconomyIdentity(tx);
    const currencyLabel = await authorize(tx, creatorId, authority);
    const viewerId = await creditedEconomyViewer(tx, parsed.viewerId);
    const [viewer] = await tx.select({ id: users.id }).from(users).where(eq(users.id, viewerId)).for("key share");
    if (!viewer) throw new Error("viewer_not_found");
    // Serialize the same event even if retries have different viewer IDs.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([creatorId, parsed.operationKey])}, 203))`);
    const [prior] = await tx.select().from(creatorLedger)
      .where(and(eq(creatorLedger.creatorId, creatorId), eq(creatorLedger.operationKey, parsed.operationKey)));
    if (prior) {
      if (!sameOperation(prior, parsed, viewerId)) throw new Error("operation_conflict");
      return { entry: prior, duplicate: true, currencyLabel };
    }
    await tx.insert(creatorBalances).values({ creatorId, viewerId }).onConflictDoNothing();
    const [balance] = await tx.select().from(creatorBalances)
      .where(and(eq(creatorBalances.creatorId, creatorId), eq(creatorBalances.viewerId, viewerId))).for("update");
    let amount: number;
    if (parsed.kind === "refund") {
      const [original] = await tx.select().from(creatorLedger).where(and(eq(creatorLedger.creatorId, creatorId),
        eq(creatorLedger.id, parsed.refundOf), eq(creatorLedger.viewerId, viewerId), eq(creatorLedger.kind, "debit")));
      if (!original) throw new Error("refund_unavailable");
      const [refunded] = await tx.select({ id: creatorLedger.id }).from(creatorLedger)
        .where(and(eq(creatorLedger.creatorId, creatorId), eq(creatorLedger.refundOf, parsed.refundOf)));
      if (refunded) throw new Error("already_refunded");
      amount = -original.amount;
    } else amount = parsed.kind === "debit" ? -parsed.amount : parsed.amount;
    const earned = balance.lifetimeEarned + (parsed.kind === "credit" ? amount : 0);
    const spent = balance.lifetimeSpent + (parsed.kind === "debit" ? -amount : parsed.kind === "refund" ? -amount : 0);
    if (balance.currentBalance + amount < 0) throw new Error("insufficient_balance");
    if ([balance.currentBalance + amount, earned, spent].some((v) => v > 2147483647 || v < 0)) throw new Error("balance_limit");
    await tx.update(creatorBalances).set({ currentBalance: sql`${creatorBalances.currentBalance} + ${amount}`,
      lifetimeEarned: earned, lifetimeSpent: spent, updatedAt: new Date() })
      .where(and(eq(creatorBalances.creatorId, creatorId), eq(creatorBalances.viewerId, viewerId), gte(creatorBalances.currentBalance, Math.max(0, -amount))));
    const [entry] = await tx.insert(creatorLedger).values({ id: randomUUID(), creatorId, viewerId,
      operationKey: parsed.operationKey, kind: parsed.kind, amount, reason: parsed.reason,
      refundOf: parsed.kind === "refund" ? parsed.refundOf : null }).returning();
    return { entry, duplicate: false, currencyLabel };
  });
}
