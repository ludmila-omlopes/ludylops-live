import { z } from "zod";

// Visual templates for a creator's public community pages. Client-safe: the
// creation and identity forms import it. The choice lives in
// creator_branding.theme_json.template, so no schema migration is needed.
export const CREATOR_TEMPLATES = ["palco", "neobrutalista"] as const;
export type CreatorTemplate = (typeof CREATOR_TEMPLATES)[number];

export const creatorTemplateSchema = z.enum(CREATOR_TEMPLATES, { message: "Escolha um template." });

/** Selected by default when a new community is created. */
export const DEFAULT_NEW_CREATOR_TEMPLATE: CreatorTemplate = "palco";
/** Communities created before templates existed already look neobrutalist. */
export const LEGACY_CREATOR_TEMPLATE: CreatorTemplate = "neobrutalista";

export const creatorTemplateOptions: Record<CreatorTemplate, { label: string; description: string }> = {
  palco: {
    label: "Palco",
    description: "Vidro translúcido, cantos arredondados e um brilho suave com as suas cores.",
  },
  neobrutalista: {
    label: "Neobrutalista",
    description: "Contornos grossos, sombras marcadas e títulos em caixa alta, com as suas cores.",
  },
};

export function creatorTemplateFrom(themeJson: Record<string, unknown> | null | undefined): CreatorTemplate {
  const parsed = creatorTemplateSchema.safeParse(themeJson?.template);
  return parsed.success ? parsed.data : LEGACY_CREATOR_TEMPLATE;
}

export function withCreatorTemplate(themeJson: Record<string, unknown> | null | undefined, template: CreatorTemplate) {
  return { ...(themeJson ?? {}), template };
}
