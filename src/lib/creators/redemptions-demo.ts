import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { RedemptionActor } from "./redemptions.server";
import type { AdminRedemption } from "@/lib/redemptions/history";
import { listDemoCreatorTenants } from "./demo-store";
import { canUseModules } from "./module-access";
import { getCurrencyLabel } from "./currency";
import { creditedDemoEconomyViewer, demoEconomyBalance, economyDemoStore } from "./economy-demo";
import { checkPurchase, RedemptionAccessError, RedemptionConflictError, type CreatorCatalogItem, type purchaseSchema, type redemptionDispatchSchema } from "./redemptions";
import { BRIDGE_RECENT_MS, type IntegrationOperations, type RecoveryInput } from "./integration-operations";

type Entry = AdminRedemption & { creatorId: string; actionRef: string; debitId: string };
declare global { var __creatorRedemptionsDemo: { items: (CreatorCatalogItem & { creatorId: string })[]; entries: Entry[] } | undefined; }
const store = () => globalThis.__creatorRedemptionsDemo ??= { items: [], entries: [] };
declare global { var __creatorOperationsDemo: { bridges: (IntegrationOperations["bridges"][number] & { creatorId: string })[]; resolutions: (IntegrationOperations["resolutions"][number] & { creatorId: string })[] } | undefined; }
const operations = () => globalThis.__creatorOperationsDemo ??= { bridges: [], resolutions: [] };
function authorize(creatorId: string, actor: RedemptionActor) {
  const tenant = listDemoCreatorTenants().find((t) => t.creator.id === creatorId);
  if (!tenant || !canUseModules(tenant, ["redemptions"], "redemptions") || (actor.kind === "owner" && tenant.creator.ownerUserId !== actor.viewerId)) throw new RedemptionAccessError();
  return getCurrencyLabel(tenant.modules.find((m) => m.moduleKey === "points")?.configJson);
}
export function demoCatalog(creatorId: string, actor: RedemptionActor, input?: CreatorCatalogItem) {
  const currencyLabel = authorize(creatorId, actor), data = store();
  if (input) {
    const item = data.items.find((i) => i.creatorId === creatorId && i.id === input.id);
    if ((item?.revision ?? 0) !== input.revision) throw new RedemptionConflictError("Este item mudou. Atualize antes de salvar.");
    if (item) Object.assign(item, input, { revision: input.revision + 1 });
    else {
      if (data.items.filter((i) => i.creatorId === creatorId).length >= 100) throw new RedemptionConflictError("Você pode manter até 100 itens.");
      data.items.push({ ...input, creatorId, revision: 1 });
    }
  }
  return { currencyLabel, items: data.items.filter((i) => i.creatorId === creatorId && (actor.kind === "owner" || i.isActive)) };
}
export function demoHistory(creatorId: string, actor: Extract<RedemptionActor, { viewerId: string }>) {
  authorize(creatorId, actor);
  return store().entries.filter((e) => e.creatorId === creatorId && (actor.kind === "owner" || creditedDemoEconomyViewer(e.viewerId) === creditedDemoEconomyViewer(actor.viewerId))).slice(0, 100)
    .map((e) => ({ id: e.id, viewerId: creditedDemoEconomyViewer(e.viewerId), catalogItemId: e.catalogItemId, itemName: e.itemName,
      status: e.status, costAtPurchase: e.costAtPurchase, requestSource: e.requestSource, idempotencyKey: e.idempotencyKey,
      bridgeAttemptCount: e.bridgeAttemptCount, claimedByBridgeId: e.claimedByBridgeId, claimedAt: e.claimedAt, executionNote: e.executionNote,
      queuedAt: e.queuedAt, executedAt: e.executedAt, failedAt: e.failedAt, failureReason: e.failureReason,
      viewerName: globalThis.__lojaDemoStore?.viewers.find((v) => v.id === creditedDemoEconomyViewer(e.viewerId))?.youtubeDisplayName ?? e.viewerName }));
}
export function demoPurchase(creatorId: string, authenticatedId: string, input: z.infer<typeof purchaseSchema>) {
  authorize(creatorId, { kind: "viewer", viewerId: authenticatedId });
  const viewerId = creditedDemoEconomyViewer(authenticatedId), data = store();
  const viewer = globalThis.__lojaDemoStore?.viewers.find((v) => v.id === viewerId);
  if (!viewer) throw new RedemptionAccessError();
  const prior = data.entries.find((e) => e.creatorId === creatorId && e.idempotencyKey === input.operationKey);
  if (prior) {
    if (creditedDemoEconomyViewer(prior.viewerId) !== viewerId || prior.catalogItemId !== input.itemId) throw new RedemptionConflictError("Esta solicitação já foi usada para outro resgate.");
    return { id: prior.id, duplicate: true };
  }
  const item = data.items.find((i) => i.creatorId === creatorId && i.id === input.itemId);
  if (!item) throw new RedemptionAccessError();
  const balance = demoEconomyBalance(creatorId, viewerId), now = new Date();
  const recent = data.entries.filter((e) => e.creatorId === creatorId && e.catalogItemId === item.id);
  const last = recent.find((e) => creditedDemoEconomyViewer(e.viewerId) === viewerId);
  checkPurchase(item, balance.currentBalance, recent[0] ? new Date(recent[0].queuedAt) : null, last ? new Date(last.queuedAt) : null, now);
  const id = randomUUID(), debitId = randomUUID();
  if (balance.lifetimeSpent + item.cost > 2147483647) throw new RedemptionConflictError("O valor ultrapassa o limite permitido.");
  balance.currentBalance -= item.cost; balance.lifetimeSpent += item.cost;
  if (item.stock !== null) item.stock--;
  item.revision++;
  economyDemoStore().entries.unshift({ id: debitId, creatorId, viewerId, operationKey: `redemption:${id}`, kind: "redemption", amount: -item.cost, reason: `Resgate: ${item.name}`, refundOf: null, createdAt: now });
  data.entries.unshift({ id, creatorId, viewerId, viewerName: viewer.youtubeDisplayName, catalogItemId: item.id, itemName: item.name,
    actionRef: item.streamerbotActionRef, debitId, status: "queued", costAtPurchase: item.cost, requestSource: "web", idempotencyKey: input.operationKey,
    bridgeAttemptCount: 0, claimedByBridgeId: null, claimedAt: null, executionNote: null, queuedAt: now.toISOString(), executedAt: null, failedAt: null, failureReason: null });
  return { id, duplicate: false };
}
export function demoDispatch(creatorId: string, input: z.infer<typeof redemptionDispatchSchema>) {
  authorize(creatorId, { kind: "integration" });
  if (input.operation === "heartbeat") {
    const lastSeenAt = new Date().toISOString(), data = operations();
    const bridge = data.bridges.find(b => b.creatorId === creatorId && b.bridgeId === input.bridgeId);
    if (bridge) bridge.lastHeartbeatAt = lastSeenAt;
    else data.bridges.push({ creatorId, bridgeId: input.bridgeId, lastHeartbeatAt: lastSeenAt, recent: true });
    return { id: input.bridgeId, lastSeenAt };
  }
  if (input.operation === "pull") return store().entries.filter((e) => e.creatorId === creatorId && e.status === "queued").slice(-10).reverse()
    .map((e) => ({ id: e.id, catalogItemId: e.catalogItemId, viewerId: e.viewerId, costAtPurchase: e.costAtPurchase,
      viewer: { youtubeDisplayName: e.viewerName }, item: { slug: e.catalogItemId, streamerbotActionRef: e.actionRef, streamerbotArgsTemplate: {} } }));
  const row = store().entries.find((e) => e.creatorId === creatorId && e.id === input.redemptionId);
  if (!row) throw new RedemptionAccessError();
  if (input.operation === "claim") {
    if (row.status !== "queued") return null;
    Object.assign(row, { status: "executing", claimedAt: new Date().toISOString(), claimedByBridgeId: input.bridgeId, bridgeAttemptCount: row.bridgeAttemptCount + 1 });
    return { id: row.id, status: row.status };
  }
  if (row.claimedByBridgeId !== input.bridgeId) throw new RedemptionAccessError();
  const terminal = input.operation === "complete" ? "completed" : "failed";
  if (row.status === terminal) return { id: row.id, status: row.status };
  if (row.status !== "executing") throw new RedemptionConflictError("Este resgate já foi finalizado.");
  if (input.operation === "complete") Object.assign(row, { status: terminal, executedAt: new Date().toISOString(), executionNote: input.executionNote });
  else {
    const viewerId = creditedDemoEconomyViewer(row.viewerId), balance = demoEconomyBalance(creatorId, viewerId);
    if (balance.currentBalance + row.costAtPurchase > 2147483647 || balance.lifetimeSpent < row.costAtPurchase) throw new RedemptionConflictError("O valor ultrapassa o limite permitido.");
    balance.currentBalance += row.costAtPurchase; balance.lifetimeSpent -= row.costAtPurchase;
    economyDemoStore().entries.unshift({ id: randomUUID(), creatorId, viewerId, operationKey: `redemption-refund:${row.id}`, kind: "refund", amount: row.costAtPurchase, refundOf: row.debitId, reason: `Estorno: ${row.itemName}`, createdAt: new Date() });
    Object.assign(row, { status: terminal, failedAt: new Date().toISOString(), failureReason: input.failureReason });
  }
  return { id: row.id, status: terminal };
}

export function demoOperations(creatorId: string, viewerId: string): IntegrationOperations {
  const currencyLabel = authorize(creatorId, { kind: "owner", viewerId }), data = operations();
  const checkedAt = new Date();
  return { currencyLabel, checkedAt: checkedAt.toISOString(),
    bridges: data.bridges.filter(b => b.creatorId === creatorId).sort((a,b) => b.lastHeartbeatAt.localeCompare(a.lastHeartbeatAt)).slice(0,20).map(b => ({ bridgeId: b.bridgeId, lastHeartbeatAt: b.lastHeartbeatAt, recent: checkedAt.getTime() - new Date(b.lastHeartbeatAt).getTime() <= BRIDGE_RECENT_MS })),
    pending: store().entries.filter(r => r.creatorId === creatorId && ["queued", "executing"].includes(r.status)).sort((a,b) => a.queuedAt.localeCompare(b.queuedAt)).slice(0,100).map(r => ({ id: r.id, itemName: r.itemName, status: r.status as "queued" | "executing", cost: r.costAtPurchase, queuedAt: r.queuedAt, claimedAt: r.claimedAt ?? null, bridgeId: r.claimedByBridgeId })),
    resolutions: data.resolutions.filter(r => r.creatorId === creatorId).slice(0,50).map(({ redemptionId, ownerViewerId, outcome, note, createdAt }) => ({ redemptionId, ownerViewerId, outcome, note, createdAt })),
  };
}
export function demoRecovery(creatorId: string, viewerId: string, input: RecoveryInput) {
  authorize(creatorId, { kind: "owner", viewerId });
  const row = store().entries.find(r => r.creatorId === creatorId && r.id === input.redemptionId);
  if (!row) throw new RedemptionAccessError();
  const prior = operations().resolutions.find(r => r.creatorId === creatorId && r.redemptionId === row.id);
  if (prior) {
    if (prior.outcome !== input.outcome || prior.note !== input.note) throw new RedemptionConflictError("Este resgate já teve uma resolução diferente. Atualize os registros.");
    return { id: row.id, status: row.status };
  }
  if (row.status !== input.expectedStatus || !row.claimedByBridgeId) throw new RedemptionConflictError("O estado do resgate mudou. Atualize antes de resolver.");
  const result = demoDispatch(creatorId, { redemptionId: row.id, bridgeId: row.claimedByBridgeId, ...(input.outcome === "completed" ? { operation: "complete", executionNote: input.note } : { operation: "fail", failureReason: input.note }) });
  operations().resolutions.unshift({ creatorId, redemptionId: row.id, ownerViewerId: viewerId, outcome: input.outcome, note: input.note, createdAt: new Date().toISOString() });
  return result;
}
