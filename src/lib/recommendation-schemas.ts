import { z } from "zod";

function isHttpUrl(value: string) {
  if (!URL.canParse(value)) {
    return false;
  }

  const parsed = new URL(value);
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

const productRecommendationCategorySchema = z
  .string()
  .trim()
  .min(2, "Digite pelo menos 2 caracteres na categoria.")
  .max(32, "Use no máximo 32 caracteres na categoria.");

export const productRecommendationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Digite pelo menos 2 caracteres no nome.")
    .max(255, "Use no máximo 255 caracteres no nome."),
  slug: z
    .string()
    .trim()
    .min(2, "O slug precisa ter ao menos 2 caracteres.")
    .max(160, "O slug pode ter no máximo 160 caracteres.")
    .optional(),
  category: productRecommendationCategorySchema,
  context: z
    .string()
    .trim()
    .min(8, "Escreva um contexto com pelo menos 8 caracteres.")
    .max(500, "Use no máximo 500 caracteres no contexto."),
  imageUrl: z
    .string()
    .trim()
    .min(1, "Informe a imagem do produto.")
    .max(2000, "Use no máximo 2000 caracteres na imagem.")
    .refine(
      (value) => value.startsWith("/") || isHttpUrl(value),
      "Use uma URL válida ou um caminho local que comece com /.",
    ),
  href: z
    .string()
    .trim()
    .min(1, "Informe o link do produto.")
    .max(2000, "Use no máximo 2000 caracteres no link.")
    .refine((value) => isHttpUrl(value), "Digite uma URL válida com http ou https."),
  storeLabel: z
    .string()
    .trim()
    .min(2, "Digite pelo menos 2 caracteres no nome da loja.")
    .max(120, "Use no máximo 120 caracteres no nome da loja."),
  linkKind: z.enum(["external", "affiliate"]).default("external"),
  isActive: z.boolean().default(true),
  sortOrder: z
    .number()
    .int("A ordem precisa ser um número inteiro.")
    .min(0, "A ordem deve ser zero ou maior.")
    .default(0),
});

export const productRecommendationStatusSchema = z.object({
  isActive: z.boolean().optional(),
  category: productRecommendationCategorySchema.optional(),
}).refine((value) => value.isActive !== undefined || value.category !== undefined, {
  message: "Informe ao menos um campo para atualizar.",
});

export function formatProductRecommendationSchemaError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Payload inválido.";
}

export function flattenProductRecommendationSchemaErrors(error: z.ZodError) {
  const fieldErrors: Partial<Record<string, string>> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || fieldErrors[field]) {
      continue;
    }

    fieldErrors[field] = issue.message;
  }

  return fieldErrors;
}
