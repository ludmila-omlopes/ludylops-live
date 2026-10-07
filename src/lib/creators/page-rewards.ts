import { z } from "zod";

// How viewers earn a community's currency without a live: a daily visit and a
// bonus when the owner picks their suggestion. Client-safe: the Economia form
// and the server share these settings, stored in the points module config.
export const pageRewardSettingsSchema = z.object({
  presenceEnabled: z.boolean(),
  presenceAmount: z.number().int().min(1, "Use pelo menos 1.").max(10_000, "Use no máximo 10.000."),
  suggestionBonusEnabled: z.boolean(),
  suggestionBonusAmount: z.number().int().min(1, "Use pelo menos 1.").max(10_000, "Use no máximo 10.000."),
}).strict();
export type PageRewardSettings = z.infer<typeof pageRewardSettingsSchema>;

/** Communities that installed the currency before page rewards existed keep them off until the owner turns them on. */
export const defaultPageRewards: PageRewardSettings = { presenceEnabled: false, presenceAmount: 10, suggestionBonusEnabled: false, suggestionBonusAmount: 50 };

/** A fresh currency install starts with both rewards on. */
export const startingPageRewards: PageRewardSettings = { ...defaultPageRewards, presenceEnabled: true, suggestionBonusEnabled: true };

export function getPageRewardSettings(config: Record<string, unknown> | null | undefined): PageRewardSettings {
  const parsed = pageRewardSettingsSchema.safeParse(config?.pageRewards);
  return parsed.success ? parsed.data : { ...defaultPageRewards };
}

export const presenceRewardReason = "Visita do dia na comunidade";
export const suggestionBonusReason = (name: string) => `Sugestão escolhida: ${name}`.slice(0, 160);

/** The day a visit counts for, in Brasília time. */
export function presenceDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
