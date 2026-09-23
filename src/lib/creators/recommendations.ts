import { z } from "zod";

function httpUrl(value: string) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
export const creatorRecommendationSchema = z.object({
  name: z.string().trim().min(2).max(255),
  category: z.string().trim().min(2).max(32),
  context: z.string().trim().min(8).max(500),
  href: z.string().trim().max(2000).refine(httpUrl, "Informe um link com http ou https."),
  imageUrl: z.string().trim().max(2000).refine((value) => !value || httpUrl(value)
    || (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")), "Informe uma imagem válida ou deixe em branco."),
  storeLabel: z.string().trim().min(2).max(120),
  linkKind: z.enum(["external", "affiliate"]),
  isActive: z.boolean(),
}).strict();
export const createRecommendationSchema = z.object({ id: z.string().uuid(), item: creatorRecommendationSchema }).strict();
export const updateRecommendationSchema = createRecommendationSchema.extend({ expected: creatorRecommendationSchema }).strict();
export type CreatorRecommendationInput = z.infer<typeof creatorRecommendationSchema>;
export type CreatorRecommendation = CreatorRecommendationInput & { id: string };
export type CreatorRecommendationPage = { items: CreatorRecommendation[]; nextCursor: string | null };
export const emptyRecommendation: CreatorRecommendationInput = {
  name: "", category: "", context: "", href: "", imageUrl: "", storeLabel: "", linkKind: "external", isActive: false,
};
export function recommendationInput(row: CreatorRecommendationInput): CreatorRecommendationInput {
  return { name: row.name, category: row.category, context: row.context, href: row.href, imageUrl: row.imageUrl,
    storeLabel: row.storeLabel, linkKind: row.linkKind, isActive: row.isActive };
}
