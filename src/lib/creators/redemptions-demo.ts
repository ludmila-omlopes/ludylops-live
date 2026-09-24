import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { RedemptionActor } from "./redemptions.server";
import type { AdminRedemption } from "@/lib/redemptions/history";
import { listDemoCreatorTenants } from "./demo-store";
import { canUseModules } from "./module-access";
import { getCurrencyLabel } from "./currency";
import { creditedDemoEconomyViewer, demoEconomyBalance, economyDemoStore } from "./economy-demo";
import { checkPurchase, RedemptionAccessError, RedemptionConflictError, type CreatorCatalogItem, type purchaseSchema, type redemptionDispatchSchema } from "./redemptions";

type Entry = AdminRedemption & { creatorId: string; actionRef: string; debitId: string };
declare global { var __creatorRedemptionsDemo: { items: (CreatorCatalogItem & { creatorId: string })[]; entries: Entry[] } | undefined; }
const store = () => globalThis.__creatorRedemptionsDemo ??= { items: [], entries: [] };
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
  if (input.operation === "heartbeat") return { id: input.bridgeId, lastSeenAt: new Date().toISOString() };
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
