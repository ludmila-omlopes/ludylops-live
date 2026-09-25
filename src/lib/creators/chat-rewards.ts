import { z } from "zod";
import { economyChannelSchema } from "./economy-input";

export const chatRewardSettingsSchema = z.object({
  enabled: z.boolean(),
  amount: z.number().int().min(1).max(10_000),
  cooldownSeconds: z.number().int().min(10).max(86_400),
}).strict();
export type ChatRewardSettings = z.infer<typeof chatRewardSettingsSchema>;
export const defaultChatRewards: ChatRewardSettings = { enabled: false, amount: 5, cooldownSeconds: 60 };
export function getChatRewardSettings(config: Record<string, unknown> | undefined): ChatRewardSettings {
  const parsed = chatRewardSettingsSchema.safeParse(config?.chatRewards);
  return parsed.success ? parsed.data : { ...defaultChatRewards };
}
const eventFields = {
  broadcastId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  messageId: z.string().min(1).max(512).regex(/^\S+$/),
};
export const chatRewardChannelSchema = economyChannelSchema.extend(eventFields).strict();
export const chatRewardInputSchema = z.object({ viewerId: z.string().min(1).max(64), ...eventFields }).strict();
export const chatRewardReason = "Participação no chat";
