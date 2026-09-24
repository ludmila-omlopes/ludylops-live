import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creatorCatalogItems as catalog, creatorRedemptions as redemptions, creatorBalances, creatorLedger, creatorModules, creators, users, creatorBridgeStatus, creatorRedemptionResolutions } from "@/lib/db/schema";
import { env, isDemoMode } from "@/lib/env";
import type { AdminRedemption } from "@/lib/redemptions/history";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { getCurrencyLabel } from "./currency";
import { canUseModules } from "./module-access";
import { creditedEconomyViewer, lockEconomyIdentity, type EconomyTx } from "./economy-identity";
import { checkPurchase, creatorCatalogSchema, purchaseSchema, redemptionDispatchSchema, RedemptionAccessError, RedemptionConflictError } from "./redemptions";
import { recoverySchema, BRIDGE_RECENT_MS, type IntegrationOperations } from "./integration-operations";
import { demoCatalog, demoPurchase, demoHistory, demoDispatch, demoOperations, demoRecovery } from "./redemptions-demo";

export type RedemptionActor = { kind: "public" } | { kind: "viewer" | "owner"; viewerId: string } | { kind: "integration" };
function database() { const db = getDb(); if (!db) throw new Error("redemption_storage_unavailable"); return db; }
export function checkRedemptionContext(creatorId: string) {
  if (!creatorId || creatorId === DEFAULT_CREATOR_ID || (!isDemoMode && env.CREATOR_ECONOMY_ENABLED !== "true")) throw new RedemptionAccessError();
}
async function authorize(tx: EconomyTx, creatorId: string, actor: RedemptionActor) {
  const [creator] = await tx.select().from(creators).where(eq(creators.id, creatorId)).for("share");
  if (!creator || (actor.kind === "owner" && creator.ownerUserId !== actor.viewerId)) throw new RedemptionAccessError();
  const modules = await tx.select().from(creatorModules).where(eq(creatorModules.creatorId, creatorId)).for("share");
  if (!canUseModules({ creator, modules }, ["redemptions"], "redemptions")) throw new RedemptionAccessError();
  return getCurrencyLabel(modules.find((m) => m.moduleKey === "points")?.configJson as Record<string, unknown>);
}
async function transaction<T>(creatorId: string, actor: RedemptionActor, action: (tx: EconomyTx, currency: string) => Promise<T>) {
  checkRedemptionContext(creatorId);
  return database().transaction(async (tx) => {
    await lockEconomyIdentity(tx);
    return action(tx, await authorize(tx, creatorId, actor));
  });
}
export async function listCreatorCatalog(creatorId: string, actor: RedemptionActor) {
  checkRedemptionContext(creatorId);
  if (isDemoMode) return demoCatalog(creatorId, actor);
  return transaction(creatorId, actor, async (tx, currencyLabel) => ({ currencyLabel,
    items: await tx.select().from(catalog).where(and(eq(catalog.creatorId, creatorId), actor.kind === "owner" ? undefined : eq(catalog.isActive, true))).orderBy(catalog.name).limit(100) }));
}
export async function saveCreatorCatalog(creatorId: string, viewerId: string, input: unknown) {
  checkRedemptionContext(creatorId);
  const parsed = creatorCatalogSchema.parse(input);
  if (isDemoMode) return demoCatalog(creatorId, { kind: "owner", viewerId }, parsed);
  return transaction(creatorId, { kind: "owner", viewerId }, async (tx) => {
    // Serialize creates and enforce the bounded catalog; stock changes share the purchase row lock.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${creatorId}, 222))`);
    const [existing] = await tx.select().from(catalog).where(and(eq(catalog.creatorId, creatorId), eq(catalog.id, parsed.id))).for("update");
    if ((existing?.revision ?? 0) !== parsed.revision) throw new RedemptionConflictError("Este item mudou. Atualize antes de salvar.");
    if (existing) return (await tx.update(catalog).set({ ...parsed, revision: parsed.revision + 1 }).where(and(eq(catalog.creatorId, creatorId), eq(catalog.id, parsed.id))).returning())[0];
    const items = await tx.select({ id: catalog.id }).from(catalog).where(eq(catalog.creatorId, creatorId)).limit(100);
    if (items.length >= 100) throw new RedemptionConflictError("Você pode manter até 100 itens.");
    return (await tx.insert(catalog).values({ ...parsed, creatorId, revision: 1 }).returning())[0];
  });
}
function historyEntry(row: typeof redemptions.$inferSelect, viewerName: string): AdminRedemption {
  return { id: row.id, viewerId: row.viewerId, catalogItemId: row.catalogItemId, itemName: row.itemName, costAtPurchase: row.costAtPurchase, idempotencyKey: row.idempotencyKey, bridgeAttemptCount: row.bridgeAttemptCount, claimedByBridgeId: row.claimedByBridgeId, executionNote: row.executionNote, failureReason: row.failureReason, viewerName, requestSource: "web", status: row.status as AdminRedemption["status"],
    queuedAt: row.queuedAt.toISOString(), claimedAt: row.claimedAt?.toISOString() ?? null,
    executedAt: row.executedAt?.toISOString() ?? null, failedAt: row.failedAt?.toISOString() ?? null };
}
export async function listCreatorRedemptions(creatorId: string, actor: Extract<RedemptionActor, { viewerId: string }>) {
  checkRedemptionContext(creatorId);
  if (isDemoMode) return demoHistory(creatorId, actor);
  return transaction(creatorId, actor, async (tx) => {
    const viewerId = await creditedEconomyViewer(tx, actor.viewerId);
    const rows = await tx.select({ row: redemptions, name: users.youtubeDisplayName }).from(redemptions)
      .innerJoin(users, eq(users.id, redemptions.viewerId))
      .where(and(eq(redemptions.creatorId, creatorId), actor.kind === "owner" ? undefined : eq(redemptions.viewerId, viewerId)))
      .orderBy(desc(redemptions.queuedAt), desc(redemptions.id)).limit(100);
    return rows.map(({ row, name }) => historyEntry(row, name));
  });
}
export async function purchaseCreatorItem(creatorId: string, authenticatedViewerId: string, input: unknown) {
  checkRedemptionContext(creatorId);
  const parsed = purchaseSchema.parse(input);
  if (isDemoMode) return demoPurchase(creatorId, authenticatedViewerId, parsed);
  return transaction(creatorId, { kind: "viewer", viewerId: authenticatedViewerId }, async (tx) => {
    const viewerId = await creditedEconomyViewer(tx, authenticatedViewerId);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([creatorId, parsed.operationKey])}, 223))`);
    const [prior] = await tx.select().from(redemptions).where(and(eq(redemptions.creatorId, creatorId), eq(redemptions.idempotencyKey, parsed.operationKey)));
    if (prior) {
      if (prior.viewerId !== viewerId || prior.catalogItemId !== parsed.itemId) throw new RedemptionConflictError("Esta solicitação já foi usada para outro resgate.");
      return { id: prior.id, duplicate: true };
    }
    const [item] = await tx.select().from(catalog).where(and(eq(catalog.creatorId, creatorId), eq(catalog.id, parsed.itemId))).for("update");
    if (!item) throw new RedemptionAccessError();
    await tx.insert(creatorBalances).values({ creatorId, viewerId }).onConflictDoNothing();
    const [balance] = await tx.select().from(creatorBalances).where(and(eq(creatorBalances.creatorId, creatorId), eq(creatorBalances.viewerId, viewerId))).for("update");
    const latest = async (personal: boolean) => (await tx.select({ at: redemptions.queuedAt }).from(redemptions)
      .where(and(eq(redemptions.creatorId, creatorId), eq(redemptions.catalogItemId, item.id), personal ? eq(redemptions.viewerId, viewerId) : undefined))
      .orderBy(desc(redemptions.queuedAt)).limit(1))[0]?.at ?? null;
    const { rows: [{ now }] } = await tx.execute<{ now: string }>(sql`select clock_timestamp() as now`);
    const queuedAt = new Date(now);
    checkPurchase(item, balance.currentBalance, await latest(false), await latest(true), queuedAt);
    const id = randomUUID(), debitId = randomUUID();
    await tx.update(creatorBalances).set({ currentBalance: balance.currentBalance - item.cost, lifetimeSpent: balance.lifetimeSpent + item.cost, updatedAt: queuedAt })
      .where(and(eq(creatorBalances.creatorId, creatorId), eq(creatorBalances.viewerId, viewerId)));
    await tx.update(catalog).set({ stock: item.stock === null ? null : item.stock - 1, revision: item.revision + 1 })
      .where(and(eq(catalog.creatorId, creatorId), eq(catalog.id, item.id)));
    // Distinct kind: the generic adjustment API cannot refund a live redemption.
    await tx.insert(creatorLedger).values({ id: debitId, creatorId, viewerId, operationKey: `redemption:${id}`, kind: "redemption", amount: -item.cost, reason: `Resgate: ${item.name}`, createdAt: queuedAt });
    await tx.insert(redemptions).values({ id, creatorId, viewerId, catalogItemId: item.id, itemName: item.name, actionRef: item.streamerbotActionRef,
      costAtPurchase: item.cost, debitId, idempotencyKey: parsed.operationKey, queuedAt });
    return { id, duplicate: false };
  });
}
/** creatorId is supplied only by authenticated credentials. Body fields cannot select a tenant. */
export async function dispatchCreatorRedemptions(creatorId: string, input: unknown) {
  checkRedemptionContext(creatorId);
  const parsed = redemptionDispatchSchema.parse(input);
  if (isDemoMode) return demoDispatch(creatorId, parsed);
  return transaction(creatorId, { kind: "integration" }, async (tx) => {
    if (parsed.operation === "heartbeat") {
      const [heartbeat] = await tx.insert(creatorBridgeStatus).values({ creatorId, bridgeId: parsed.bridgeId })
        .onConflictDoUpdate({ target: [creatorBridgeStatus.creatorId, creatorBridgeStatus.bridgeId], set: { lastHeartbeatAt: sql`clock_timestamp()` } })
        .returning({ lastSeenAt: creatorBridgeStatus.lastHeartbeatAt });
      return { id: parsed.bridgeId, lastSeenAt: heartbeat.lastSeenAt.toISOString() };
    }
    if (parsed.operation === "pull") {
      const rows = await tx.select({ row: redemptions, name: users.youtubeDisplayName }).from(redemptions).innerJoin(users, eq(users.id, redemptions.viewerId))
        .where(and(eq(redemptions.creatorId, creatorId), eq(redemptions.status, "queued"))).orderBy(redemptions.queuedAt).limit(10);
      return rows.map(({ row, name }) => ({ id: row.id, catalogItemId: row.catalogItemId, viewerId: row.viewerId, costAtPurchase: row.costAtPurchase,
        viewer: { youtubeDisplayName: name }, item: { slug: row.catalogItemId, streamerbotActionRef: row.actionRef, streamerbotArgsTemplate: {} } }));
    }
    const filter = and(eq(redemptions.creatorId, creatorId), eq(redemptions.id, parsed.redemptionId));
    const [row] = await tx.select().from(redemptions).where(filter).for("update");
    if (!row) throw new RedemptionAccessError();
    if (parsed.operation === "claim") {
      if (row.status !== "queued") return null; // A lost claim response never grants a second execution.
      return (await tx.update(redemptions).set({ status: "executing", claimedAt: new Date(), claimedByBridgeId: parsed.bridgeId, bridgeAttemptCount: row.bridgeAttemptCount + 1 }).where(filter).returning({ id: redemptions.id, status: redemptions.status }))[0];
    }
    if (row.claimedByBridgeId !== parsed.bridgeId) throw new RedemptionAccessError();
    return finalizeRedemption(tx, row, parsed.operation === "complete" ? "completed" : "failed", parsed.operation === "complete" ? parsed.executionNote : parsed.failureReason);
  });
}

async function finalizeRedemption(tx: EconomyTx, row: typeof redemptions.$inferSelect, outcome: "completed" | "failed", note: string) {
  const creatorId = row.creatorId;
  const filter = and(eq(redemptions.creatorId, creatorId), eq(redemptions.id, row.id));
  const terminal = outcome;
  if (row.status === terminal) return { id: row.id, status: row.status };
  if (row.status !== "executing") throw new RedemptionConflictError("Este resgate já foi finalizado.");
  if (outcome === "completed") {
    await tx.update(redemptions).set({ status: terminal, executedAt: new Date(), executionNote: note }).where(filter);
  } else {
    const viewerId = await creditedEconomyViewer(tx, row.viewerId);
    const [debit] = await tx.select().from(creatorLedger).where(and(eq(creatorLedger.id, row.debitId), eq(creatorLedger.creatorId, creatorId), eq(creatorLedger.viewerId, viewerId), eq(creatorLedger.kind, "redemption")));
    if (!debit || debit.amount !== -row.costAtPurchase) throw new Error("redemption_debit_mismatch");
    // Balance row lock serializes with all credits/debits; unique refundOf prevents another refund path.
    const [balance] = await tx.select().from(creatorBalances).where(and(eq(creatorBalances.creatorId, creatorId), eq(creatorBalances.viewerId, viewerId))).for("update");
    if (!balance) throw new Error("redemption_balance_missing");
    await tx.update(creatorBalances).set({ currentBalance: balance.currentBalance + row.costAtPurchase, lifetimeSpent: balance.lifetimeSpent - row.costAtPurchase, updatedAt: new Date() })
      .where(and(eq(creatorBalances.creatorId, creatorId), eq(creatorBalances.viewerId, viewerId)));
    await tx.insert(creatorLedger).values({ id: randomUUID(), creatorId, viewerId, operationKey: `redemption-refund:${row.id}`, kind: "refund", amount: row.costAtPurchase, refundOf: row.debitId, reason: `Estorno: ${row.itemName}` });
    await tx.update(redemptions).set({ status: terminal, failedAt: new Date(), failureReason: note }).where(filter);
  }
  // Stock stays consumed: a failed action may have partially run and requires owner review.
  return { id: row.id, status: terminal };
}

export async function getCreatorOperations(creatorId: string, viewerId: string): Promise<IntegrationOperations> {
  checkRedemptionContext(creatorId);
  if (isDemoMode) return demoOperations(creatorId, viewerId);
  return transaction(creatorId, { kind: "owner", viewerId }, async (tx, currencyLabel) => {
    const { rows: [{ now }] } = await tx.execute<{ now: string }>(sql`select clock_timestamp() as now`);
    const checkedAt = new Date(now);
    const bridges = await tx.select({ bridgeId: creatorBridgeStatus.bridgeId, lastHeartbeatAt: creatorBridgeStatus.lastHeartbeatAt }).from(creatorBridgeStatus)
      .where(eq(creatorBridgeStatus.creatorId, creatorId)).orderBy(desc(creatorBridgeStatus.lastHeartbeatAt)).limit(20);
    const pending = await tx.select({ id: redemptions.id, itemName: redemptions.itemName, status: redemptions.status, cost: redemptions.costAtPurchase, queuedAt: redemptions.queuedAt, claimedAt: redemptions.claimedAt, bridgeId: redemptions.claimedByBridgeId }).from(redemptions)
      .where(and(eq(redemptions.creatorId, creatorId), inArray(redemptions.status, ["queued", "executing"]))).orderBy(redemptions.queuedAt).limit(100);
    const resolutions = await tx.select().from(creatorRedemptionResolutions).where(eq(creatorRedemptionResolutions.creatorId, creatorId)).orderBy(desc(creatorRedemptionResolutions.createdAt)).limit(50);
    return { checkedAt: checkedAt.toISOString(), currencyLabel,
      bridges: bridges.map(b => ({ bridgeId: b.bridgeId, lastHeartbeatAt: b.lastHeartbeatAt.toISOString(), recent: checkedAt.getTime() - b.lastHeartbeatAt.getTime() <= BRIDGE_RECENT_MS })),
      pending: pending.map(r => ({ ...r, status: r.status as "queued" | "executing", queuedAt: r.queuedAt.toISOString(), claimedAt: r.claimedAt?.toISOString() ?? null })),
      resolutions: resolutions.map(r => ({ redemptionId: r.redemptionId, ownerViewerId: r.ownerViewerId, outcome: r.outcome, note: r.note, createdAt: r.createdAt.toISOString() })),
    };
  });
}

/** Records the owner's observed outcome, never executes/requeues an action. */
export async function recoverCreatorRedemption(creatorId: string, viewerId: string, input: unknown) {
  checkRedemptionContext(creatorId);
  const parsed = recoverySchema.parse(input);
  if (isDemoMode) return demoRecovery(creatorId, viewerId, parsed);
  return transaction(creatorId, { kind: "owner", viewerId }, async tx => {
    const [row] = await tx.select().from(redemptions).where(and(eq(redemptions.creatorId, creatorId), eq(redemptions.id, parsed.redemptionId))).for("update");
    if (!row) throw new RedemptionAccessError();
    const [prior] = await tx.select().from(creatorRedemptionResolutions).where(and(eq(creatorRedemptionResolutions.creatorId, creatorId), eq(creatorRedemptionResolutions.redemptionId, row.id)));
    if (prior) {
      if (prior.outcome !== parsed.outcome || prior.note !== parsed.note) throw new RedemptionConflictError("Este resgate já teve uma resolução diferente. Atualize os registros.");
      return { id: row.id, status: row.status };
    }
    if (row.status !== parsed.expectedStatus) throw new RedemptionConflictError("O estado do resgate mudou. Atualize antes de resolver.");
    await tx.insert(creatorRedemptionResolutions).values({ redemptionId: row.id, creatorId, ownerViewerId: viewerId, outcome: parsed.outcome, note: parsed.note });
    return finalizeRedemption(tx, row, parsed.outcome, parsed.note);
  });
}
