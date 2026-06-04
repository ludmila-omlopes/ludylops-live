import { z } from "zod";

export const gameSuggestionStatusSchema = z.enum(["open", "accepted", "played", "rejected"]);

export const createGameSuggestionSchema = z.object({
  name: z.string().trim().min(2, "Digite pelo menos 2 caracteres.").max(120, "Use no máximo 120 caracteres."),
  description: z
    .string()
    .trim()
    .max(500, "Use no máximo 500 caracteres.")
    .optional()
    .transform((value) => (value ? value : undefined)),
  igdbId: z.number().int().positive().optional(),
  canonicalName: z.string().trim().min(2).max(120).optional(),
  coverImageUrl: z.string().trim().url().max(500).optional(),
  releaseYear: z.number().int().min(1950).max(2100).nullable().optional(),
  platforms: z.array(z.string().trim().min(1).max(80)).max(4).optional(),
  genres: z.array(z.string().trim().min(1).max(80)).max(3).optional(),
});

export const boostGameSuggestionSchema = z.object({
  amount: z.number().int().positive("Digite um valor inteiro positivo."),
});

export const updateGameSuggestionStatusSchema = z.object({
  status: gameSuggestionStatusSchema,
});

export const updateGameSuggestionCatalogSchema = z.object({
  igdbId: z.number().int().positive(),
  canonicalName: z.string().trim().min(2).max(120),
  coverImageUrl: z.string().trim().url().max(500).nullable().optional(),
  releaseYear: z.number().int().min(1950).max(2100).nullable().optional(),
  platforms: z.array(z.string().trim().min(1).max(80)).max(4).optional(),
  genres: z.array(z.string().trim().min(1).max(80)).max(3).optional(),
});

export const updateGameSuggestionBoostSettingsSchema = z.object({
  psPlusMultiplier: z.number().min(0).max(10),
  shortGameMultiplier: z.number().min(0).max(10),
  adminSuggestionMultiplier: z.number().min(0).max(10),
});

export function validateGameSuggestionDraft(input: {
  name: string;
  description?: string | null;
  igdbId?: number;
  canonicalName?: string;
  coverImageUrl?: string;
  releaseYear?: number | null;
  platforms?: string[];
  genres?: string[];
}) {
  const parsed = createGameSuggestionSchema.safeParse({
    name: input.name,
    description: input.description ?? undefined,
    igdbId: input.igdbId,
    canonicalName: input.canonicalName,
    coverImageUrl: input.coverImageUrl,
    releaseYear: input.releaseYear,
    platforms: input.platforms,
    genres: input.genres,
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Sugestão inválida.";
  }

  return null;
}

export function validateGameSuggestionBoostAmount(amount: number) {
  const parsed = boostGameSuggestionSchema.safeParse({ amount });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Valor inválido.";
  }
  return null;
}

export function formatGameSuggestionSchemaError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Payload inválido.";
}
