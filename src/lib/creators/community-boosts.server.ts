import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { creatorBalances, creatorLedger } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import { getCurrencyLabel } from "./currency";
import { listDemoCreatorTenants } from "./demo-store";
import { creditedDemoEconomyViewer, demoEconomyBalance, economyDemoStore, mutateDemoEconomy } from "./economy-demo";
import type { CommunityWallet } from "./community-boosts";
import { readCreatorEconomy } from "./economy";
import { creditedEconomyViewer, type EconomyTx } from "./economy-identity";
import { canUseModules } from "./module-access";
import { communityEconomyEnabled } from "./economy-switch";
import { lockedCurrency } from "./page-rewards.server";

/** No currency in this community, or the economy is switched off. The message is shown as is. */
export class CurrencyUnavailableError extends Error {
  constructor(message = "Boost indisponível nesta comunidade.") { super(message); }
}
/** A spend that cannot go through (short balance, reused request). The message is shown as is. */
export class CurrencySpendError extends Error {}

/** A debit of the viewer's community currency, keyed so a repeated request never charges twice. */
export type CurrencySpend = { creatorId: string; viewerId: string; operationKey: string; kind: string; amount: number; reason: string; unavailable?: string };
export type SpendResult = { viewerId: string; balance: number; currencyLabel: string; duplicate: boolean };

const reused = "Esse pedido já foi usado. Atualize a página e tente de novo.";
const balanceMessage = (balance: number, currencyLabel: string) =>
  `Saldo insuficiente: você tem ${balance.toLocaleString("pt-BR")} ${currencyLabel}.`;

/**
 * Debits inside the caller's transaction. The caller takes lockEconomyIdentity
 * first and locks whatever the spend changes. A repeated operation key with the
 * same viewer and amount returns the first result without charging again.
 * Distinct kinds keep these debits out of the generic adjustment refunds.
 */
export async function spendCommunityCurrency(tx: EconomyTx, spend: CurrencySpend): Promise<SpendResult> {
  if (!communityEconomyEnabled()) throw new CurrencyUnavailableError(spend.unavailable);
  const currency = await lockedCurrency(tx, spend.creatorId);
  if (!currency) throw new CurrencyUnavailableError(spend.unavailable);
  const viewerId = await creditedEconomyViewer(tx, spend.viewerId);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([spend.creatorId, spend.operationKey])}, 203))`);
  await tx.insert(creatorBalances).values({ creatorId: spend.creatorId, viewerId }).onConflictDoNothing();
  const [balance] = await tx.select().from(creatorBalances)
    .where(and(eq(creatorBalances.creatorId, spend.creatorId), eq(creatorBalances.viewerId, viewerId))).for("update");
  const [prior] = await tx.select({ viewerId: creatorLedger.viewerId, amount: creatorLedger.amount }).from(creatorLedger)
    .where(and(eq(creatorLedger.creatorId, spend.creatorId), eq(creatorLedger.operationKey, spend.operationKey)));
  if (prior) {
    if (prior.viewerId !== viewerId || prior.amount !== -spend.amount) throw new CurrencySpendError(reused);
    return { viewerId, balance: balance.currentBalance, currencyLabel: currency.currencyLabel, duplicate: true };
  }
  if (balance.currentBalance < spend.amount) throw new CurrencySpendError(balanceMessage(balance.currentBalance, currency.currencyLabel));
  const next = balance.currentBalance - spend.amount;
  await tx.update(creatorBalances).set({ currentBalance: next, lifetimeSpent: balance.lifetimeSpent + spend.amount, updatedAt: new Date() })
    .where(and(eq(creatorBalances.creatorId, spend.creatorId), eq(creatorBalances.viewerId, viewerId)));
  await tx.insert(creatorLedger).values({ id: randomUUID(), creatorId: spend.creatorId, viewerId, operationKey: spend.operationKey, kind: spend.kind, amount: -spend.amount, reason: spend.reason.slice(0, 160) });
  return { viewerId, balance: next, currencyLabel: currency.currencyLabel, duplicate: false };
}

/** Demo counterpart of spendCommunityCurrency. */
export function spendDemoCommunityCurrency(spend: CurrencySpend): SpendResult {
  if (!isDemoMode) throw new CurrencyUnavailableError(spend.unavailable);
  const tenant = listDemoCreatorTenants().find((entry) => entry.creator.id === spend.creatorId);
  const points = tenant?.modules.find((module) => module.moduleKey === "points" && module.status === "installed");
  if (!tenant || tenant.creator.status !== "active" || !points) throw new CurrencyUnavailableError(spend.unavailable);
  const currencyLabel = getCurrencyLabel(points.configJson);
  const viewerId = creditedDemoEconomyViewer(spend.viewerId);
  const prior = economyDemoStore().entries.find((entry) => entry.creatorId === spend.creatorId && entry.operationKey === spend.operationKey);
  const current = demoEconomyBalance(spend.creatorId, viewerId).currentBalance;
  if (prior) {
    if (prior.viewerId !== viewerId || prior.amount !== -spend.amount) throw new CurrencySpendError(reused);
    return { viewerId, balance: current, currencyLabel, duplicate: true };
  }
  if (current < spend.amount) throw new CurrencySpendError(balanceMessage(current, currencyLabel));
  const { entry } = mutateDemoEconomy(spend.creatorId, { kind: "debit", viewerId, operationKey: spend.operationKey, amount: spend.amount, reason: spend.reason.slice(0, 160) });
  entry.kind = spend.kind;
  return { viewerId, balance: demoEconomyBalance(spend.creatorId, viewerId).currentBalance, currencyLabel, duplicate: false };
}

export type BoostSpend = { creatorId: string; viewerId: string; boostId: string; amount: number; suggestionKey: string; name: string };
const boostSpend = (spend: BoostSpend): CurrencySpend => ({
  creatorId: spend.creatorId, viewerId: spend.viewerId, operationKey: `boost:${spend.suggestionKey}:${spend.boostId}`,
  kind: "boost", amount: spend.amount, reason: `Boost: ${spend.name}`,
});

/** Debits a boost inside the suggestion's transaction; the caller locks the suggestion row first. */
export function spendOnBoost(tx: EconomyTx, spend: BoostSpend) {
  return spendCommunityCurrency(tx, boostSpend(spend));
}

/** Demo counterpart of spendOnBoost. */
export function spendDemoOnBoost(spend: BoostSpend) {
  return spendDemoCommunityCurrency(boostSpend(spend));
}

/** The signed-in viewer's balance for boosts and bets; null where the currency is unavailable. */
export async function readCommunityWallet(tenant: Parameters<typeof canUseModules>[0], viewerId?: string): Promise<CommunityWallet | null> {
  if (!tenant || !viewerId || !communityEconomyEnabled() || !canUseModules(tenant, ["points"], "economy")) return null;
  try {
    const economy = await readCreatorEconomy({ creatorId: tenant.creator.id }, { kind: "viewer", viewerId }, viewerId);
    return { currencyLabel: economy.currencyLabel, balance: economy.balance.currentBalance };
  } catch {
    return null;
  }
}
