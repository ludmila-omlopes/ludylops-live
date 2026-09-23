import { randomUUID } from "node:crypto";
import type { EconomyMutation } from "./economy-input";

export type EconomyBalance = { currentBalance: number; lifetimeEarned: number; lifetimeSpent: number };
export type EconomyEntry = { id: string; creatorId: string; viewerId: string; operationKey: string; kind: string; amount: number; reason: string; refundOf: string | null; createdAt: Date };
declare global {
  var __creatorEconomyDemo: { balances: Record<string, EconomyBalance>; entries: EconomyEntry[]; redirects: Record<string, string> } | undefined;
}
export function economyDemoStore() {
  return globalThis.__creatorEconomyDemo ??= { balances: {}, entries: [], redirects: {} };
}
export function demoEconomyViewer(id: string) {
  const redirects = economyDemoStore().redirects;
  const seen = new Set<string>();
  while (redirects[id]) {
    if (seen.has(id)) throw new Error("economy_identity_cycle");
    seen.add(id); id = redirects[id];
  }
  return id;
}
export function creditedDemoEconomyViewer(id: string) {
  const canonical = demoEconomyViewer(id);
  const identity = globalThis.__lojaDemoStore;
  const link = identity?.googleAccountViewers.find((a) => a.viewerId === canonical);
  const account = identity?.googleAccounts.find((a) => a.id === link?.googleAccountId);
  return account?.activeViewerId ? demoEconomyViewer(account.activeViewerId) : canonical;
}
const key = (creatorId: string, viewerId: string) => JSON.stringify([creatorId, viewerId]);
export function demoEconomyBalance(creatorId: string, viewerId: string) {
  return economyDemoStore().balances[key(creatorId, viewerId)] ?? { currentBalance: 0, lifetimeEarned: 0, lifetimeSpent: 0 };
}
export function mutateDemoEconomy(creatorId: string, input: EconomyMutation) {
  const store = economyDemoStore();
  const viewerId = creditedDemoEconomyViewer(input.viewerId);
  const prior = store.entries.find((e) => e.creatorId === creatorId && e.operationKey === input.operationKey);
  if (prior) {
    if (!sameOperation(prior, input, viewerId)) throw new Error("operation_conflict");
    return { entry: prior, duplicate: true };
  }
  const balance = { ...demoEconomyBalance(creatorId, viewerId) };
  let amount: number;
  if (input.kind === "refund") {
    const original = store.entries.find((e) => e.creatorId === creatorId && e.id === input.refundOf && e.viewerId === viewerId && e.kind === "debit");
    if (!original) throw new Error("refund_unavailable");
    if (store.entries.some((e) => e.creatorId === creatorId && e.refundOf === input.refundOf)) throw new Error("already_refunded");
    amount = -original.amount;
    balance.lifetimeSpent -= amount;
  } else {
    amount = input.kind === "debit" ? -input.amount : input.amount;
    if (amount > 0) balance.lifetimeEarned += amount;
    else balance.lifetimeSpent -= amount;
  }
  balance.currentBalance += amount;
  if (balance.currentBalance < 0) throw new Error("insufficient_balance");
  if (Object.values(balance).some((v) => v > 2147483647 || v < 0)) throw new Error("balance_limit");
  const entry: EconomyEntry = { id: randomUUID(), creatorId, viewerId, operationKey: input.operationKey,
    kind: input.kind, amount, reason: input.reason, refundOf: input.kind === "refund" ? input.refundOf : null, createdAt: new Date() };
  store.balances[key(creatorId, viewerId)] = balance;
  store.entries.unshift(entry);
  return { entry, duplicate: false };
}
export function sameOperation(entry: EconomyEntry, input: EconomyMutation, viewerId: string) {
  return entry.viewerId === viewerId && entry.kind === input.kind && entry.reason === input.reason
    && (input.kind === "refund" ? entry.refundOf === input.refundOf : entry.amount === (input.kind === "debit" ? -input.amount : input.amount));
}
export function mergeDemoEconomies(sourceId: string, targetId: string, reactivateTarget = false) {
  const store = economyDemoStore();
  const source = demoEconomyViewer(sourceId), target = reactivateTarget ? targetId : demoEconomyViewer(targetId);
  if (reactivateTarget) delete store.redirects[target];
  if (source === target) return;
  for (const [encoded, balance] of Object.entries(store.balances)) {
    const [creatorId, viewerId] = JSON.parse(encoded) as [string, string];
    if (viewerId !== source) continue;
    const existing = demoEconomyBalance(creatorId, target);
    store.balances[key(creatorId, target)] = {
      currentBalance: existing.currentBalance + balance.currentBalance,
      lifetimeEarned: existing.lifetimeEarned + balance.lifetimeEarned,
      lifetimeSpent: existing.lifetimeSpent + balance.lifetimeSpent,
    };
    delete store.balances[encoded];
  }
  store.entries.forEach((entry) => { if (entry.viewerId === source) entry.viewerId = target; });
  for (const id of Object.keys(store.redirects)) if (store.redirects[id] === source) store.redirects[id] = target;
  store.redirects[source] = target;
}
export function consolidateDemoAccountEconomies(accountId: string, targetId: string) {
  mergeDemoEconomies(targetId, targetId, true);
  for (const link of globalThis.__lojaDemoStore?.googleAccountViewers ?? [])
    if (link.googleAccountId === accountId && link.viewerId !== targetId) mergeDemoEconomies(link.viewerId, targetId, true);
}
