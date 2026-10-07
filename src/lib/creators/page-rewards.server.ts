import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { creatorBalances, creatorLedger, creatorModules, creators, users } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import { getCurrencyLabel } from "./currency";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import { communityEconomyEnabled } from "./economy-switch";
import { economyDemoStore, creditedDemoEconomyViewer, mutateDemoEconomy } from "./economy-demo";
import { creditedEconomyViewer, lockEconomyIdentity, type EconomyTx } from "./economy-identity";
import {
  getPageRewardSettings,
  pageRewardSettingsSchema,
  presenceDay,
  presenceRewardReason,
  suggestionBonusReason,
  type PageRewardSettings,
} from "./page-rewards";
import { CurrencyAccessError } from "./currency.server";


export type PresenceResult = { credited: boolean; amount: number; currencyLabel: string };

function database() {
  const db = getDb();
  if (!db) throw new Error("economy_storage_unavailable");
  return db;
}

/** Active community with the currency installed; its settings come from the locked module row. */
export async function lockedCurrency(tx: EconomyTx, creatorId: string) {
  const [creator] = await tx.select({ status: creators.status, ownerUserId: creators.ownerUserId }).from(creators).where(eq(creators.id, creatorId)).for("share");
  const [points] = await tx.select({ status: creatorModules.status, configJson: creatorModules.configJson }).from(creatorModules)
    .where(and(eq(creatorModules.creatorId, creatorId), eq(creatorModules.moduleKey, "points"))).for("share");
  if (!creator || creator.status !== "active" || points?.status !== "installed") return null;
  const config = points.configJson as Record<string, unknown>;
  return { ownerUserId: creator.ownerUserId, settings: getPageRewardSettings(config), currencyLabel: getCurrencyLabel(config) };
}

/** Credits once per operation key; a repeated key is a no-op. Returns whether it credited. */
async function creditOnce(tx: EconomyTx, input: { creatorId: string; viewerId: string; operationKey: string; kind: string; amount: number; reason: string }) {
  const { creatorId, viewerId, operationKey, amount } = input;
  const [viewer] = await tx.select({ id: users.id }).from(users).where(eq(users.id, viewerId)).for("key share");
  if (!viewer) return false;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([creatorId, operationKey])}, 203))`);
  const [prior] = await tx.select({ id: creatorLedger.id }).from(creatorLedger)
    .where(and(eq(creatorLedger.creatorId, creatorId), eq(creatorLedger.operationKey, operationKey)));
  if (prior) return false;
  await tx.insert(creatorBalances).values({ creatorId, viewerId }).onConflictDoNothing();
  const [balance] = await tx.select().from(creatorBalances)
    .where(and(eq(creatorBalances.creatorId, creatorId), eq(creatorBalances.viewerId, viewerId))).for("update");
  if (balance.currentBalance + amount > 2147483647 || balance.lifetimeEarned + amount > 2147483647) return false;
  await tx.update(creatorBalances).set({ currentBalance: balance.currentBalance + amount, lifetimeEarned: balance.lifetimeEarned + amount, updatedAt: new Date() })
    .where(and(eq(creatorBalances.creatorId, creatorId), eq(creatorBalances.viewerId, viewerId)));
  await tx.insert(creatorLedger).values({ id: randomUUID(), creatorId, viewerId, operationKey, kind: input.kind, amount, reason: input.reason });
  return true;
}

function demoCurrency(creatorId: string) {
  const tenant = listDemoCreatorTenants().find((entry) => entry.creator.id === creatorId);
  const points = tenant?.modules.find((module) => module.moduleKey === "points");
  if (!tenant || tenant.creator.status !== "active" || points?.status !== "installed") return null;
  return { ownerUserId: tenant.creator.ownerUserId, settings: getPageRewardSettings(points.configJson), currencyLabel: getCurrencyLabel(points.configJson) };
}

function creditDemoOnce(creatorId: string, input: { viewerId: string; operationKey: string; kind: string; amount: number; reason: string }) {
  if (economyDemoStore().entries.some((entry) => entry.creatorId === creatorId && entry.operationKey === input.operationKey)) return false;
  const { entry } = mutateDemoEconomy(creatorId, { kind: "credit", viewerId: input.viewerId, operationKey: input.operationKey, amount: input.amount, reason: input.reason });
  entry.kind = input.kind;
  return true;
}

/**
 * The daily visit reward. viewerId comes from the session; the amount and the
 * switch come from the community's locked currency settings.
 */
export async function rewardCommunityPresence(creatorId: string, viewerId: string): Promise<PresenceResult> {
  if (!creatorId || creatorId === DEFAULT_CREATOR_ID || !viewerId || !communityEconomyEnabled()) throw new CurrencyAccessError();
  const day = presenceDay();
  if (isDemoMode) {
    const currency = demoCurrency(creatorId);
    if (!currency) throw new CurrencyAccessError();
    const { presenceEnabled, presenceAmount } = currency.settings;
    const canonical = creditedDemoEconomyViewer(viewerId);
    const credited = presenceEnabled && creditDemoOnce(creatorId, { viewerId: canonical, operationKey: `presence:${day}:${canonical}`, kind: "presence_reward", amount: presenceAmount, reason: presenceRewardReason });
    return { credited, amount: presenceAmount, currencyLabel: currency.currencyLabel };
  }
  return database().transaction(async (tx) => {
    await lockEconomyIdentity(tx);
    const currency = await lockedCurrency(tx, creatorId);
    if (!currency) throw new CurrencyAccessError();
    const { presenceEnabled, presenceAmount } = currency.settings;
    if (!presenceEnabled) return { credited: false, amount: presenceAmount, currencyLabel: currency.currencyLabel };
    const canonical = await creditedEconomyViewer(tx, viewerId);
    const credited = await creditOnce(tx, { creatorId, viewerId: canonical, operationKey: `presence:${day}:${canonical}`, kind: "presence_reward", amount: presenceAmount, reason: presenceRewardReason });
    return { credited, amount: presenceAmount, currencyLabel: currency.currencyLabel };
  });
}

export type SuggestionBonus = { creatorId: string; authorId: string; suggestionKey: string; name: string };

/**
 * Runs inside the transaction that moves a suggestion to its picked state. The
 * caller takes lockEconomyIdentity first. Credits the author once per
 * suggestion, never the owner, and quietly does nothing without the currency.
 */
export async function rewardSuggestionAuthor(tx: EconomyTx, bonus: SuggestionBonus) {
  if (!communityEconomyEnabled()) return false;
  await lockEconomyIdentity(tx);
  const currency = await lockedCurrency(tx, bonus.creatorId);
  if (!currency?.settings.suggestionBonusEnabled || bonus.authorId === currency.ownerUserId) return false;
  const canonical = await creditedEconomyViewer(tx, bonus.authorId);
  return creditOnce(tx, { creatorId: bonus.creatorId, viewerId: canonical, operationKey: `suggestion:${bonus.suggestionKey}`,
    kind: "suggestion_bonus", amount: currency.settings.suggestionBonusAmount, reason: suggestionBonusReason(bonus.name) });
}

/** Demo counterpart of rewardSuggestionAuthor. */
export function rewardDemoSuggestionAuthor(bonus: SuggestionBonus) {
  const currency = demoCurrency(bonus.creatorId);
  if (!currency?.settings.suggestionBonusEnabled || bonus.authorId === currency.ownerUserId) return false;
  return creditDemoOnce(bonus.creatorId, { viewerId: creditedDemoEconomyViewer(bonus.authorId), operationKey: `suggestion:${bonus.suggestionKey}`,
    kind: "suggestion_bonus", amount: currency.settings.suggestionBonusAmount, reason: suggestionBonusReason(bonus.name) });
}

function ownerIdentity(ownerId: string, creatorId: string) {
  if (!ownerId || !creatorId || creatorId === DEFAULT_CREATOR_ID) throw new CurrencyAccessError();
}

function demoOwnedPoints(ownerId: string, creatorId: string) {
  const tenant = listDemoCreatorTenants().find((entry) => entry.creator.id === creatorId && entry.creator.ownerUserId === ownerId && entry.creator.status === "active");
  const points = tenant?.modules.find((module) => module.moduleKey === "points" && ["installed", "disabled"].includes(module.status));
  if (!points) throw new CurrencyAccessError();
  return points;
}

/** ownerId comes from the session. */
export async function getOwnedPageRewards(ownerId: string, creatorId: string): Promise<PageRewardSettings> {
  ownerIdentity(ownerId, creatorId);
  if (isDemoMode) return getPageRewardSettings(demoOwnedPoints(ownerId, creatorId).configJson);
  const [row] = await database().select({ config: creatorModules.configJson }).from(creators)
    .innerJoin(creatorModules, eq(creatorModules.creatorId, creators.id))
    .where(and(eq(creators.id, creatorId), eq(creators.ownerUserId, ownerId), eq(creators.status, "active"),
      eq(creatorModules.moduleKey, "points"), inArray(creatorModules.status, ["installed", "disabled"]))).limit(1);
  if (!row) throw new CurrencyAccessError();
  return getPageRewardSettings(row.config as Record<string, unknown>);
}

/** ownerId comes from the session. */
export async function updateOwnedPageRewards(ownerId: string, creatorId: string, input: unknown): Promise<PageRewardSettings> {
  ownerIdentity(ownerId, creatorId);
  const pageRewards = pageRewardSettingsSchema.parse(input);
  if (isDemoMode) {
    const points = demoOwnedPoints(ownerId, creatorId);
    points.configJson = { ...points.configJson, pageRewards };
    points.updatedAt = new Date().toISOString();
    return pageRewards;
  }
  return database().transaction(async (tx) => {
    const [creator] = await tx.select({ id: creators.id }).from(creators)
      .where(and(eq(creators.id, creatorId), eq(creators.ownerUserId, ownerId), eq(creators.status, "active"))).for("update");
    if (!creator) throw new CurrencyAccessError();
    const [updated] = await tx.update(creatorModules).set({
      configJson: sql`${creatorModules.configJson} || ${JSON.stringify({ pageRewards })}::jsonb`, updatedAt: new Date(),
    }).where(and(eq(creatorModules.creatorId, creatorId), eq(creatorModules.moduleKey, "points"),
      inArray(creatorModules.status, ["installed", "disabled"]))).returning({ id: creatorModules.id });
    if (!updated) throw new CurrencyAccessError();
    return pageRewards;
  });
}
