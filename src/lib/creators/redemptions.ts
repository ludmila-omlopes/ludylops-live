import { z } from "zod";

const id = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/);
export const creatorCatalogSchema = z.object({
  id,
  revision: z.number().int().min(0),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000),
  cost: z.number().int().min(1).max(1_000_000),
  stock: z.number().int().min(0).max(1_000_000).nullable(),
  isActive: z.boolean(),
  globalCooldownSeconds: z.number().int().min(0).max(86400),
  viewerCooldownSeconds: z.number().int().min(0).max(86400),
  streamerbotActionRef: z.string().trim().min(1).max(255),
}).strict();
export type CreatorCatalogItem = z.infer<typeof creatorCatalogSchema>;
export type PublicCatalogItem = Omit<CreatorCatalogItem, "streamerbotActionRef" | "revision">;
export const purchaseSchema = z.object({ itemId: id, operationKey: z.string().uuid() }).strict();
export const redemptionDispatchSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("pull"), bridgeId: id }).strict(),
  z.object({ operation: z.literal("heartbeat"), bridgeId: id }).strict(),
  z.object({ operation: z.literal("claim"), bridgeId: id, redemptionId: id }).strict(),
  z.object({ operation: z.literal("complete"), bridgeId: id, redemptionId: id, executionNote: z.string().trim().min(1).max(255) }).strict(),
  z.object({ operation: z.literal("fail"), bridgeId: id, redemptionId: id, failureReason: z.string().trim().min(1).max(255) }).strict(),
]);
export class RedemptionAccessError extends Error {}
export class RedemptionConflictError extends Error {}
export function publicCatalogItem(item: CreatorCatalogItem): PublicCatalogItem {
  const { id, name, description, cost, stock, isActive, globalCooldownSeconds, viewerCooldownSeconds } = item;
  return { id, name, description, cost, stock, isActive, globalCooldownSeconds, viewerCooldownSeconds };
}
export function checkPurchase(item: CreatorCatalogItem, balance: number, latest: Date | null, latestViewer: Date | null, now: Date) {
  if (!item.isActive) throw new RedemptionConflictError("Este resgate está pausado.");
  if (item.stock !== null && item.stock < 1) throw new RedemptionConflictError("Este resgate esgotou.");
  if (balance < item.cost) throw new RedemptionConflictError("Saldo insuficiente nesta comunidade.");
  if ((latest && now.getTime() - latest.getTime() < item.globalCooldownSeconds * 1000)
    || (latestViewer && now.getTime() - latestViewer.getTime() < item.viewerCooldownSeconds * 1000))
    throw new RedemptionConflictError("Aguarde o intervalo entre resgates.");
}
