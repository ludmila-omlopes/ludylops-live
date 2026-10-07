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

/** No currency in this community, or the economy is switched off. */
export class BoostUnavailableError extends Error {
  constructor() { super("Boost indisponível nesta comunidade."); }
}
/** The message is shown to the viewer as is. */
export class BoostBalanceError extends Error {}

export type BoostSpend = { creatorId: string; viewerId: string; boostId: string; amount: number; suggestionKey: string; name: string };
export type BoostResult = { viewerId: string; balance: number; currencyLabel: string; duplicate: boolean };

const reason = (name: string) => `Boost: ${name}`.slice(0, 160);
const balanceMessage = (balance: number, currencyLabel: string) =>
  `Saldo insuficiente: você tem ${balance.toLocaleString("pt-BR")} ${currencyLabel}.`;

/**
 * Debits the boost inside the suggestion's transaction. The caller takes
 * lockEconomyIdentity first and locks the suggestion row. A repeated boostId
 * returns the first result without charging again.
 */
export async function spendOnBoost(tx: EconomyTx, spend: BoostSpend): Promise<BoostResult> {
  if (!communityEconomyEnabled()) throw new BoostUnavailableError();
  const currency = await lockedCurrency(tx, spend.creatorId);
  if (!currency) throw new BoostUnavailableError();
  const viewerId = await creditedEconomyViewer(tx, spend.viewerId);
  const operationKey = `boost:${spend.suggestionKey}:${spend.boostId}`;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([spend.creatorId, operationKey])}, 203))`);
  await tx.insert(creatorBalances).values({ creatorId: spend.creatorId, viewerId }).onConflictDoNothing();
  const [balance] = await tx.select().from(creatorBalances)
    .where(and(eq(creatorBalances.creatorId, spend.creatorId), eq(creatorBalances.viewerId, viewerId))).for("update");
  const [prior] = await tx.select({ viewerId: creatorLedger.viewerId, amount: creatorLedger.amount }).from(creatorLedger)
    .where(and(eq(creatorLedger.creatorId, spend.creatorId), eq(creatorLedger.operationKey, operationKey)));
  if (prior) {
    if (prior.viewerId !== viewerId || prior.amount !== -spend.amount) throw new BoostBalanceError("Esse boost já foi usado. Atualize a página e tente de novo.");
    return { viewerId, balance: balance.currentBalance, currencyLabel: currency.currencyLabel, duplicate: true };
  }
  if (balance.currentBalance < spend.amount) throw new BoostBalanceError(balanceMessage(balance.currentBalance, currency.currencyLabel));
  const next = balance.currentBalance - spend.amount;
  await tx.update(creatorBalances).set({ currentBalance: next, lifetimeSpent: balance.lifetimeSpent + spend.amount, updatedAt: new Date() })
    .where(and(eq(creatorBalances.creatorId, spend.creatorId), eq(creatorBalances.viewerId, viewerId)));
  // Distinct kind: the generic adjustment API cannot refund a boost.
  await tx.insert(creatorLedger).values({ id: randomUUID(), creatorId: spend.creatorId, viewerId, operationKey, kind: "boost", amount: -spend.amount, reason: reason(spend.name) });
  return { viewerId, balance: next, currencyLabel: currency.currencyLabel, duplicate: false };
}

/** The signed-in viewer's balance for the boost control; null where boosts are unavailable. */
export async function readCommunityWallet(tenant: Parameters<typeof canUseModules>[0], viewerId?: string): Promise<CommunityWallet | null> {
  if (!tenant || !viewerId || !communityEconomyEnabled() || !canUseModules(tenant, ["points"], "economy")) return null;
  try {
    const economy = await readCreatorEconomy({ creatorId: tenant.creator.id }, { kind: "viewer", viewerId }, viewerId);
    return { currencyLabel: economy.currencyLabel, balance: economy.balance.currentBalance };
  } catch {
    return null;
  }
}

/** Demo counterpart of spendOnBoost. */
export function spendDemoOnBoost(spend: BoostSpend): BoostResult {
  if (!isDemoMode) throw new BoostUnavailableError();
  const tenant = listDemoCreatorTenants().find((entry) => entry.creator.id === spend.creatorId);
  const points = tenant?.modules.find((module) => module.moduleKey === "points" && module.status === "installed");
  if (!tenant || tenant.creator.status !== "active" || !points) throw new BoostUnavailableError();
  const currencyLabel = getCurrencyLabel(points.configJson);
  const viewerId = creditedDemoEconomyViewer(spend.viewerId);
  const operationKey = `boost:${spend.suggestionKey}:${spend.boostId}`;
  const prior = economyDemoStore().entries.find((entry) => entry.creatorId === spend.creatorId && entry.operationKey === operationKey);
  const current = demoEconomyBalance(spend.creatorId, viewerId).currentBalance;
  if (prior) {
    if (prior.viewerId !== viewerId || prior.amount !== -spend.amount) throw new BoostBalanceError("Esse boost já foi usado. Atualize a página e tente de novo.");
    return { viewerId, balance: current, currencyLabel, duplicate: true };
  }
  if (current < spend.amount) throw new BoostBalanceError(balanceMessage(current, currencyLabel));
  const { entry } = mutateDemoEconomy(spend.creatorId, { kind: "debit", viewerId, operationKey, amount: spend.amount, reason: reason(spend.name) });
  entry.kind = "boost";
  return { viewerId, balance: demoEconomyBalance(spend.creatorId, viewerId).currentBalance, currencyLabel, duplicate: false };
}
