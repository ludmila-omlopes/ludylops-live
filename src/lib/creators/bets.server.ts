import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";

import { calculateBetPayouts } from "@/lib/bets/service";
import { getDb } from "@/lib/db/client";
import { betEntries, betOptions, bets, creatorModules, creators } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import type { BetEntryRecord, BetOptionRecord } from "@/lib/types";
import {
  communityBetActionSchema,
  createCommunityBetSchema,
  placeCommunityBetSchema,
  readMinBet,
  type CommunityBet,
  type CommunityBetBoard,
  type CommunityBetStatus,
} from "./bets";
import { spendCommunityCurrency, spendDemoCommunityCurrency, type CurrencySpend } from "./community-boosts.server";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import { creditedDemoEconomyViewer } from "./economy-demo";
import { creditedEconomyViewer, lockEconomyIdentity, type EconomyTx } from "./economy-identity";
import { canUseModules } from "./module-access";
import { creditCommunityOnce, creditDemoCommunityOnce } from "./page-rewards.server";

/** Unknown community, missing module, wrong owner or unknown bet: callers answer 404. */
export class CommunityBetAccessError extends Error {}
/** The message is shown to the viewer as is. */
export class CommunityBetConflictError extends Error {}

type BetRow = typeof bets.$inferSelect;
type OptionRow = typeof betOptions.$inferSelect;
type EntryRow = typeof betEntries.$inferSelect;
declare global { var __communityBetsDemo: { bets: BetRow[]; options: OptionRow[]; entries: EntryRow[] } | undefined; }
const demo = () => globalThis.__communityBetsDemo ??= { bets: [], options: [], entries: [] };

const HISTORY_LIMIT = 20;
const ACTIVE: CommunityBetStatus[] = ["open", "locked"];
const FINISHED: CommunityBetStatus[] = ["resolved", "cancelled"];
const unavailable = "Apostas indisponíveis nesta comunidade.";

function identity(creatorId: string, viewerId?: string) {
  if (!creatorId || creatorId === DEFAULT_CREATOR_ID || viewerId === "") throw new CommunityBetAccessError();
}

function database() {
  const db = getDb();
  if (!db) throw new Error("community_bet_storage_unavailable");
  return db;
}

function authorizeDemo(creatorId: string, ownerId?: string) {
  const tenant = listDemoCreatorTenants().find((entry) => entry.creator.id === creatorId);
  if (!canUseModules(tenant ?? null, ["bets"], "bets")
    || (ownerId !== undefined && tenant?.creator.ownerUserId !== ownerId)) throw new CommunityBetAccessError();
  return readMinBet(tenant!.modules.find((module) => module.moduleKey === "bets")!.configJson);
}

async function authorize(tx: EconomyTx, creatorId: string, ownerId?: string) {
  const [creator] = await tx.select({ id: creators.id, status: creators.status, ownerUserId: creators.ownerUserId })
    .from(creators).where(eq(creators.id, creatorId)).for("share");
  if (!creator || (ownerId !== undefined && creator.ownerUserId !== ownerId)) throw new CommunityBetAccessError();
  const modules = await tx.select({ moduleKey: creatorModules.moduleKey, status: creatorModules.status, configJson: creatorModules.configJson })
    .from(creatorModules).where(and(eq(creatorModules.creatorId, creatorId), inArray(creatorModules.moduleKey, ["bets", "points"]))).for("share");
  if (!canUseModules({ creator, modules }, ["bets"], "bets")) throw new CommunityBetAccessError();
  return readMinBet(modules.find((module) => module.moduleKey === "bets")!.configJson as Record<string, unknown>);
}

function toBet(bet: BetRow, options: OptionRow[], entries: EntryRow[], viewerId?: string): CommunityBet {
  const own = options.filter((option) => option.betId === bet.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const betEntriesOf = entries.filter((entry) => entry.betId === bet.id);
  const mine = viewerId ? betEntriesOf.find((entry) => entry.viewerId === viewerId) : undefined;
  return {
    id: bet.id,
    question: bet.question,
    status: bet.status as CommunityBetStatus,
    closesAt: bet.closesAt.toISOString(),
    acceptingEntries: bet.status === "open" && bet.closesAt.getTime() > Date.now(),
    options: own.map((option) => ({ id: option.id, label: option.label, pool: option.poolAmount })),
    totalPool: own.reduce((sum, option) => sum + option.poolAmount, 0),
    winningOptionId: bet.winningOptionId,
    refunded: bet.status === "cancelled" || (bet.status === "resolved" && betEntriesOf.length > 0 && betEntriesOf.every((entry) => entry.refundedAt)),
    entryCount: betEntriesOf.length,
    myEntry: mine ? { optionId: mine.optionId, amount: mine.amount, payoutAmount: mine.payoutAmount, refunded: Boolean(mine.refundedAt) } : null,
    createdAt: bet.createdAt.toISOString(),
  };
}

const newest = (a: BetRow, b: BetRow) => b.createdAt.getTime() - a.createdAt.getTime();
const settledTime = (bet: BetRow) => (bet.resolvedAt ?? bet.cancelledAt ?? bet.createdAt).getTime();

function demoBoard(creatorId: string, viewerId: string | undefined, minBet: number): CommunityBetBoard {
  const store = demo();
  const rows = store.bets.filter((bet) => bet.creatorId === creatorId);
  const pick = (statuses: CommunityBetStatus[], sort: (a: BetRow, b: BetRow) => number) => rows
    .filter((bet) => statuses.includes(bet.status as CommunityBetStatus)).sort(sort).slice(0, HISTORY_LIMIT)
    .map((bet) => toBet(bet, store.options, store.entries, viewerId));
  return { active: pick(ACTIVE, newest), finished: pick(FINISHED, (a, b) => settledTime(b) - settledTime(a)), minBet };
}

async function readBoard(tx: EconomyTx, creatorId: string, viewerId: string | undefined, minBet: number): Promise<CommunityBetBoard> {
  const [active, finished] = await Promise.all([
    tx.select().from(bets).where(and(eq(bets.creatorId, creatorId), inArray(bets.status, ACTIVE))).orderBy(desc(bets.createdAt)).limit(HISTORY_LIMIT),
    tx.select().from(bets).where(and(eq(bets.creatorId, creatorId), inArray(bets.status, FINISHED))).orderBy(desc(bets.createdAt)).limit(HISTORY_LIMIT),
  ]);
  const ids = [...active, ...finished].map((bet) => bet.id);
  const [options, entries] = ids.length ? await Promise.all([
    tx.select().from(betOptions).where(and(eq(betOptions.creatorId, creatorId), inArray(betOptions.betId, ids))),
    tx.select().from(betEntries).where(and(eq(betEntries.creatorId, creatorId), inArray(betEntries.betId, ids))),
  ]) : [[], []];
  const map = (list: BetRow[]) => list.map((bet) => toBet(bet, options, entries, viewerId));
  return { active: map(active), finished: map([...finished].sort((a, b) => settledTime(b) - settledTime(a))), minBet };
}

async function readBet(tx: EconomyTx, creatorId: string, betId: string, viewerId?: string) {
  const [bet] = await tx.select().from(bets).where(and(eq(bets.creatorId, creatorId), eq(bets.id, betId)));
  const [options, entries] = await Promise.all([
    tx.select().from(betOptions).where(and(eq(betOptions.creatorId, creatorId), eq(betOptions.betId, betId))),
    tx.select().from(betEntries).where(and(eq(betEntries.creatorId, creatorId), eq(betEntries.betId, betId))),
  ]);
  return toBet(bet, options, entries, viewerId);
}

/** Omitting viewerId is the anonymous read. A supplied viewerId comes from the session. */
export async function listCommunityBets(creatorId: string, viewerId?: string) {
  identity(creatorId, viewerId);
  if (isDemoMode) return demoBoard(creatorId, viewerId && creditedDemoEconomyViewer(viewerId), authorizeDemo(creatorId));
  return database().transaction(async (tx) => {
    const minBet = await authorize(tx, creatorId);
    return readBoard(tx, creatorId, viewerId && await creditedEconomyViewer(tx, viewerId), minBet);
  }, { isolationLevel: "repeatable read" });
}

/** ownerId must come from the authenticated session. */
export async function listOwnedCommunityBets(creatorId: string, ownerId: string) {
  identity(creatorId, ownerId);
  if (!ownerId) throw new CommunityBetAccessError();
  if (isDemoMode) return demoBoard(creatorId, undefined, authorizeDemo(creatorId, ownerId));
  return database().transaction(async (tx) => readBoard(tx, creatorId, undefined, await authorize(tx, creatorId, ownerId)), { isolationLevel: "repeatable read" });
}

/** ownerId comes from the session. The bet opens right away and takes entries until it closes. */
export async function createCommunityBet(creatorId: string, ownerId: string, input: unknown) {
  identity(creatorId, ownerId);
  if (!ownerId) throw new CommunityBetAccessError();
  const parsed = createCommunityBetSchema.parse(input);
  const now = new Date();
  const bet: BetRow = {
    id: randomUUID(), creatorId, question: parsed.question, optionMode: "preset", status: "open", openedAt: now,
    closesAt: new Date(now.getTime() + parsed.closesInMinutes * 60_000), lockedAt: null, resolvedAt: null, cancelledAt: null, winningOptionId: null, createdAt: now,
  };
  const options: OptionRow[] = parsed.options.map((label, index) => ({ id: randomUUID(), creatorId, betId: bet.id, label, sortOrder: index, poolAmount: 0 }));
  if (isDemoMode) {
    authorizeDemo(creatorId, ownerId);
    demo().bets.unshift(bet);
    demo().options.push(...options);
    return toBet(bet, options, []);
  }
  return database().transaction(async (tx) => {
    await authorize(tx, creatorId, ownerId);
    await tx.insert(bets).values(bet);
    await tx.insert(betOptions).values(options);
    return toBet(bet, options, []);
  });
}

function placementSpend(creatorId: string, viewerId: string, bet: BetRow, placementId: string, amount: number): CurrencySpend {
  return { creatorId, viewerId, operationKey: `bet:${bet.id}:${placementId}`, kind: "bet", amount, reason: `Aposta: ${bet.question}`, unavailable };
}

function checkPlacement(bet: BetRow | undefined, optionId: string, options: OptionRow[], amount: number, minBet: number) {
  if (!bet) throw new CommunityBetAccessError();
  if (bet.status !== "open") throw new CommunityBetConflictError("Essa aposta não está mais aberta.");
  if (bet.closesAt.getTime() <= Date.now()) throw new CommunityBetConflictError("As apostas para essa pergunta já foram encerradas.");
  if (!options.some((option) => option.betId === bet.id && option.id === optionId)) throw new CommunityBetConflictError("Escolha uma das opções da aposta.");
  if (amount < minBet) throw new CommunityBetConflictError(`Aposte pelo menos ${minBet.toLocaleString("pt-BR")}.`);
}

const otherOption = "Você já apostou em outra opção dessa pergunta. Só dá para aumentar a aposta na mesma opção.";

/**
 * viewerId comes from the session. Spends the community currency and adds it
 * to the chosen option's pool; betting again adds to the same option.
 */
export async function placeCommunityBet(creatorId: string, viewerId: string, betId: string, input: unknown) {
  identity(creatorId, viewerId);
  if (!viewerId || !/^[0-9a-f-]{36}$/i.test(betId)) throw new CommunityBetAccessError();
  const { placementId, optionId, amount } = placeCommunityBetSchema.parse(input);
  if (isDemoMode) {
    const minBet = authorizeDemo(creatorId);
    const store = demo();
    const bet = store.bets.find((entry) => entry.creatorId === creatorId && entry.id === betId);
    checkPlacement(bet, optionId, store.options, amount, minBet);
    const canonical = creditedDemoEconomyViewer(viewerId);
    const existing = store.entries.find((entry) => entry.betId === betId && entry.viewerId === canonical);
    if (existing && existing.optionId !== optionId) throw new CommunityBetConflictError(otherOption);
    const spent = spendDemoCommunityCurrency(placementSpend(creatorId, viewerId, bet!, placementId, amount));
    if (!spent.duplicate) {
      if (existing) existing.amount += amount;
      else store.entries.push({ id: randomUUID(), creatorId, betId, optionId, viewerId: spent.viewerId, amount, isHouseEntry: false, payoutAmount: null, settledAt: null, refundedAt: null, createdAt: new Date() });
      store.options.find((option) => option.id === optionId)!.poolAmount += amount;
    }
    return { item: toBet(bet!, store.options, store.entries, spent.viewerId), wallet: { balance: spent.balance, currencyLabel: spent.currencyLabel } };
  }
  return database().transaction(async (tx) => {
    await lockEconomyIdentity(tx);
    const minBet = await authorize(tx, creatorId);
    const [bet] = await tx.select().from(bets).where(and(eq(bets.creatorId, creatorId), eq(bets.id, betId))).for("update");
    const options = bet ? await tx.select().from(betOptions).where(and(eq(betOptions.creatorId, creatorId), eq(betOptions.betId, betId))) : [];
    checkPlacement(bet, optionId, options, amount, minBet);
    const spent = await spendCommunityCurrency(tx, placementSpend(creatorId, viewerId, bet, placementId, amount));
    if (!spent.duplicate) {
      const [existing] = await tx.select().from(betEntries)
        .where(and(eq(betEntries.creatorId, creatorId), eq(betEntries.betId, betId), eq(betEntries.viewerId, spent.viewerId)));
      // Throwing here rolls the debit back with the rest of the transaction.
      if (existing && existing.optionId !== optionId) throw new CommunityBetConflictError(otherOption);
      if (existing) {
        await tx.update(betEntries).set({ amount: existing.amount + amount }).where(and(eq(betEntries.creatorId, creatorId), eq(betEntries.id, existing.id)));
      } else {
        await tx.insert(betEntries).values({ id: randomUUID(), creatorId, betId, optionId, viewerId: spent.viewerId, amount });
      }
      const option = options.find((entry) => entry.id === optionId)!;
      await tx.update(betOptions).set({ poolAmount: option.poolAmount + amount }).where(and(eq(betOptions.creatorId, creatorId), eq(betOptions.id, optionId)));
    }
    return { item: await readBet(tx, creatorId, betId, spent.viewerId), wallet: { balance: spent.balance, currencyLabel: spent.currencyLabel } };
  });
}

type Settlement = { refund: EntryRow[]; payouts: { entry: EntryRow; payoutAmount: number }[] };

/** Who gets what when a bet resolves: the winners split the whole pool, or everyone is refunded when nobody won. */
function settle(entries: EntryRow[], options: OptionRow[], winningOptionId: string): Settlement {
  const records: BetEntryRecord[] = entries.map((entry) => ({
    id: entry.id, betId: entry.betId, optionId: entry.optionId, viewerId: entry.viewerId, amount: entry.amount,
    payoutAmount: entry.payoutAmount, settledAt: null, refundedAt: null, createdAt: entry.createdAt.toISOString(),
  }));
  const pools: BetOptionRecord[] = options.map((option) => ({ id: option.id, betId: option.betId, label: option.label, sortOrder: option.sortOrder, poolAmount: option.poolAmount }));
  if (!entries.some((entry) => entry.optionId === winningOptionId)) return { refund: entries, payouts: [] };
  const amounts = new Map(calculateBetPayouts({ entries: records, options: pools, winningOptionId }).map((payout) => [payout.entryId, payout.payoutAmount]));
  return { refund: [], payouts: entries.map((entry) => ({ entry, payoutAmount: amounts.get(entry.id) ?? 0 })) };
}

const refundReason = (question: string) => `Aposta devolvida: ${question}`;
const payoutReason = (question: string) => `Prêmio da aposta: ${question}`;

/** ownerId comes from the session. Locks, resolves (paying winners) or cancels (refunding everyone). */
export async function actOnCommunityBet(creatorId: string, ownerId: string, input: unknown) {
  identity(creatorId, ownerId);
  if (!ownerId) throw new CommunityBetAccessError();
  const action = communityBetActionSchema.parse(input);
  const now = new Date();
  const transition = (bet: BetRow | undefined) => {
    if (!bet) throw new CommunityBetAccessError();
    if (action.action === "lock" && bet.status !== "open") throw new CommunityBetConflictError("Só dá para encerrar uma aposta aberta.");
    if (action.action !== "lock" && !ACTIVE.includes(bet.status as CommunityBetStatus)) throw new CommunityBetConflictError("Essa aposta já foi finalizada.");
  };
  if (isDemoMode) {
    authorizeDemo(creatorId, ownerId);
    const store = demo();
    const bet = store.bets.find((entry) => entry.creatorId === creatorId && entry.id === action.betId);
    transition(bet);
    const options = store.options.filter((option) => option.betId === bet!.id);
    const entries = store.entries.filter((entry) => entry.betId === bet!.id);
    if (action.action === "lock") Object.assign(bet!, { status: "locked", lockedAt: now });
    else {
      if (action.action === "resolve" && !options.some((option) => option.id === action.winningOptionId)) throw new CommunityBetConflictError("Escolha uma das opções da aposta.");
      const outcome = action.action === "cancel" ? { refund: entries, payouts: [] } : settle(entries, options, action.winningOptionId);
      for (const entry of outcome.refund) {
        creditDemoCommunityOnce(creatorId, { viewerId: creditedDemoEconomyViewer(entry.viewerId), operationKey: `bet-refund:${entry.id}`, kind: "bet_refund", amount: entry.amount, reason: refundReason(bet!.question) });
        entry.refundedAt = now;
      }
      for (const { entry, payoutAmount } of outcome.payouts) {
        if (payoutAmount > 0) creditDemoCommunityOnce(creatorId, { viewerId: creditedDemoEconomyViewer(entry.viewerId), operationKey: `bet-payout:${entry.id}`, kind: "bet_payout", amount: payoutAmount, reason: payoutReason(bet!.question) });
        Object.assign(entry, { payoutAmount, settledAt: now });
      }
      Object.assign(bet!, action.action === "cancel"
        ? { status: "cancelled", cancelledAt: now }
        : { status: "resolved", resolvedAt: now, lockedAt: bet!.lockedAt ?? now, winningOptionId: action.winningOptionId });
    }
    return toBet(bet!, store.options, store.entries);
  }
  return database().transaction(async (tx) => {
    // Payouts and refunds credit viewers; the identity lock comes first, as in every currency operation.
    await lockEconomyIdentity(tx);
    await authorize(tx, creatorId, ownerId);
    const [bet] = await tx.select().from(bets).where(and(eq(bets.creatorId, creatorId), eq(bets.id, action.betId))).for("update");
    transition(bet);
    const filter = and(eq(bets.creatorId, creatorId), eq(bets.id, bet.id));
    if (action.action === "lock") {
      await tx.update(bets).set({ status: "locked", lockedAt: now }).where(filter);
      return readBet(tx, creatorId, bet.id);
    }
    const [options, entries] = await Promise.all([
      tx.select().from(betOptions).where(and(eq(betOptions.creatorId, creatorId), eq(betOptions.betId, bet.id))),
      tx.select().from(betEntries).where(and(eq(betEntries.creatorId, creatorId), eq(betEntries.betId, bet.id))),
    ]);
    if (action.action === "resolve" && !options.some((option) => option.id === action.winningOptionId)) throw new CommunityBetConflictError("Escolha uma das opções da aposta.");
    const outcome = action.action === "cancel" ? { refund: entries, payouts: [] } : settle(entries, options, action.winningOptionId);
    for (const entry of outcome.refund) {
      await creditCommunityOnce(tx, { creatorId, viewerId: await creditedEconomyViewer(tx, entry.viewerId), operationKey: `bet-refund:${entry.id}`, kind: "bet_refund", amount: entry.amount, reason: refundReason(bet.question) });
      await tx.update(betEntries).set({ refundedAt: now }).where(and(eq(betEntries.creatorId, creatorId), eq(betEntries.id, entry.id)));
    }
    for (const { entry, payoutAmount } of outcome.payouts) {
      if (payoutAmount > 0) await creditCommunityOnce(tx, { creatorId, viewerId: await creditedEconomyViewer(tx, entry.viewerId), operationKey: `bet-payout:${entry.id}`, kind: "bet_payout", amount: payoutAmount, reason: payoutReason(bet.question) });
      await tx.update(betEntries).set({ payoutAmount, settledAt: now }).where(and(eq(betEntries.creatorId, creatorId), eq(betEntries.id, entry.id)));
    }
    await tx.update(bets).set(action.action === "cancel"
      ? { status: "cancelled", cancelledAt: now }
      : { status: "resolved", resolvedAt: now, lockedAt: bet.lockedAt ?? now, winningOptionId: action.winningOptionId }).where(filter);
    return readBet(tx, creatorId, bet.id);
  });
}
