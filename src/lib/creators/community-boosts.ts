import { z } from "zod";

// Boosting a suggestion with the community currency. Client-safe: the boost
// control and the APIs share this input.

/** The browser sends a fresh boostId per boost, so a retried request never charges twice. */
export const communityBoostInputSchema = z.object({
  boostId: z.string().uuid(),
  amount: z.number().int().min(1, "Use pelo menos 1.").max(10_000, "Use no máximo 10.000 por boost."),
}).strict();

/** The signed-in viewer's balance on a community page with the currency on. */
export type CommunityWallet = { currencyLabel: string; balance: number };
