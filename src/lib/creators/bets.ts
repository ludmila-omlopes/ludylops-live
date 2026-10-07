import { z } from "zod";

// Community bets on the page, with the community currency. Client-safe: the
// public page, the owner section and the APIs share these schemas and shapes.
export const COMMUNITY_BET_STATUSES = ["open", "locked", "resolved", "cancelled"] as const;
export type CommunityBetStatus = (typeof COMMUNITY_BET_STATUSES)[number];

export const DEFAULT_MIN_BET = 10;
export const MAX_BET = 100_000;
/** From 5 minutes to 7 days. */
export const BET_DURATION_MINUTES = { min: 5, max: 7 * 24 * 60, standard: 24 * 60 } as const;

export function readMinBet(config: Record<string, unknown> | null | undefined) {
  const value = config?.minBet;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_BET ? value : DEFAULT_MIN_BET;
}

const optionLabel = z.string().trim().min(1, "Preencha todas as opções.").max(80, "Use no máximo 80 caracteres por opção.");

export const createCommunityBetSchema = z.object({
  question: z.string().trim().min(5, "Escreva a pergunta da aposta.").max(200, "Use no máximo 200 caracteres."),
  options: z.array(optionLabel).min(2, "Ofereça pelo menos 2 opções.").max(6, "Use no máximo 6 opções.")
    .refine((labels) => new Set(labels.map((label) => label.toLocaleLowerCase("pt-BR"))).size === labels.length, "As opções precisam ser diferentes."),
  closesInMinutes: z.number().int().min(BET_DURATION_MINUTES.min, "Deixe a aposta aberta por pelo menos 5 minutos.")
    .max(BET_DURATION_MINUTES.max, "Deixe a aposta aberta por no máximo 7 dias."),
}).strict();

/** The browser sends a fresh placementId per bet, so a retried request never charges twice. */
export const placeCommunityBetSchema = z.object({
  placementId: z.string().uuid(),
  optionId: z.string().uuid(),
  amount: z.number().int().min(1, "Aposte pelo menos 1.").max(MAX_BET, "Aposte no máximo 100.000 de uma vez."),
}).strict();

export const communityBetActionSchema = z.discriminatedUnion("action", [
  z.object({ betId: z.string().uuid(), action: z.literal("lock") }).strict(),
  z.object({ betId: z.string().uuid(), action: z.literal("cancel") }).strict(),
  z.object({ betId: z.string().uuid(), action: z.literal("resolve"), winningOptionId: z.string().uuid() }).strict(),
]);

export type CommunityBetEntry = {
  optionId: string;
  amount: number;
  /** Credited when the bet resolved in the viewer's favor. */
  payoutAmount: number | null;
  refunded: boolean;
};

export type CommunityBet = {
  id: string;
  question: string;
  status: CommunityBetStatus;
  closesAt: string;
  /** Open and before its closing time, as of the server's read. */
  acceptingEntries: boolean;
  options: { id: string; label: string; pool: number }[];
  totalPool: number;
  winningOptionId: string | null;
  /** True when nobody bet on the winner and every entry was refunded. */
  refunded: boolean;
  entryCount: number;
  /** The reading viewer's own entry. */
  myEntry: CommunityBetEntry | null;
  createdAt: string;
};

export type CommunityBetBoard = {
  /** Open or locked, newest first. */
  active: CommunityBet[];
  /** Resolved or cancelled, most recent first. */
  finished: CommunityBet[];
  minBet: number;
};
