import { z } from "zod";

export const creatorSuggestionStatusSchema = z.enum(["open", "accepted", "featured", "rejected"]);
export const creatorPlatformSchema = z.enum(["youtube", "twitch", "kick", "other"]);

export const createCreatorSuggestionSchema = z.object({
  name: z.string().trim().min(2, "Digite pelo menos 2 caracteres.").max(120, "Use no maximo 120 caracteres."),
  channelUrl: z.string().trim().url("Cole um link valido.").max(500, "Link muito longo."),
  platform: creatorPlatformSchema,
  category: z
    .string()
    .trim()
    .max(120, "Use no maximo 120 caracteres.")
    .optional()
    .transform((value) => (value ? value : undefined)),
  reason: z
    .string()
    .trim()
    .max(500, "Use no maximo 500 caracteres.")
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const boostCreatorSuggestionSchema = z.object({
  amount: z.number().int().positive("Digite um valor inteiro positivo."),
});

export const updateCreatorSuggestionStatusSchema = z.object({
  status: creatorSuggestionStatusSchema,
});

export function validateCreatorSuggestionDraft(input: {
  name: string;
  channelUrl: string;
  platform: string;
  category?: string | null;
  reason?: string | null;
}) {
  const parsed = createCreatorSuggestionSchema.safeParse({
    name: input.name,
    channelUrl: input.channelUrl,
    platform: input.platform,
    category: input.category ?? undefined,
    reason: input.reason ?? undefined,
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Indicação inválida.";
  }

  return null;
}

export function validateCreatorSuggestionBoostAmount(amount: number) {
  const parsed = boostCreatorSuggestionSchema.safeParse({ amount });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Valor inválido.";
  }
  return null;
}

export function formatCreatorSuggestionSchemaError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Payload inválido.";
}
