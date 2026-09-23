import { z } from "zod";

const operationKey = z.string().min(1).max(128).refine((key) => !key.startsWith("chat:"), "Chave de operação reservada.");

export const economyMutationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.enum(["credit", "debit"]),
    viewerId: z.string().min(1).max(64),
    operationKey,
    amount: z.number().int().positive().max(1_000_000),
    reason: z.string().trim().min(1).max(160),
  }).strict(),
  z.object({
    kind: z.literal("refund"),
    viewerId: z.string().min(1).max(64),
    operationKey,
    refundOf: z.string().min(1).max(64),
    reason: z.string().trim().min(1).max(160),
  }).strict(),
]);
export type EconomyMutation = z.infer<typeof economyMutationSchema>;

const channel = {
  viewerExternalId: z.string().regex(/^UC[A-Za-z0-9_-]{22}$/, "Informe o ID do canal do YouTube (começa com UC)."),
  youtubeDisplayName: z.string().trim().min(1).max(255).optional(),
};
export const economyChannelSchema = z.object(channel);
export const economyChannelMutationSchema = z.discriminatedUnion("kind", [
  economyMutationSchema.options[0].omit({ viewerId: true }).extend(channel).strict(),
  economyMutationSchema.options[1].omit({ viewerId: true }).extend(channel).strict(),
]);
