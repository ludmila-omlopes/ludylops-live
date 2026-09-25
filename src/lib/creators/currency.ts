import { z } from "zod";

export const currencyLabelSchema = z.string()
  .transform((value) => value.normalize("NFC").trim())
  .pipe(z.string().min(1, "Informe o nome da moeda.").max(32, "Use até 32 caracteres.")
    .regex(/^[\p{L}\p{N}][\p{L}\p{M}\p{N} '’_-]*$/u,
      "Use letras, números, espaços, hífens ou apóstrofos."));

export const currencySettingsSchema = z.object({ currencyLabel: currencyLabelSchema }).strict();

/** Presentation only: a currency name never grants access to an economy. */
export function getCurrencyLabel(config: Record<string, unknown> | undefined) {
  const parsed = currencyLabelSchema.safeParse(config?.currencyLabel);
  return parsed.success ? parsed.data : "pontos";
}
