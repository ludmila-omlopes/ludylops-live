import { z } from "zod";

const color = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor como #c7a2e9.");
export const creatorProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres.").max(80, "Use até 80 caracteres."),
  primaryColor: color,
  accentColor: color,
}).strict();
export const creatorProfileUpdateSchema = z.object({ profile: creatorProfileSchema, expected: creatorProfileSchema }).strict();
export type CreatorProfile = z.infer<typeof creatorProfileSchema>;

export function profileMatches(a: CreatorProfile, b: CreatorProfile) {
  return a.displayName === b.displayName && a.primaryColor.toLowerCase() === b.primaryColor.toLowerCase()
    && a.accentColor.toLowerCase() === b.accentColor.toLowerCase();
}

/** Legacy/corrupt branding must not become arbitrary CSS. */
export function safeCreatorColor(value: string, fallback: string) {
  return color.safeParse(value).success ? value.trim() : fallback;
}

/** Pick the more readable of black/white on a solid sRGB background. */
export function creatorColorInk(value: string) {
  const hex = safeCreatorColor(value, "#c7a2e9");
  const rgb = [1, 3, 5].map((start) => {
    const c = parseInt(hex.slice(start, start + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
}
