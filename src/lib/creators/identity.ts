import { slugify } from "@/lib/utils";

export const CREATOR_SLUG_RESERVED_WORDS = new Set([
  "admin",
  "api",
  "apostas",
  "auth",
  "c",
  "contadores",
  "criar-area",
  "indicacoes",
  "jogos",
  "me",
  "obs",
  "privacy",
  "produtinhos",
  "quotes",
  "ranking",
  "terms",
  "videos",
  "www",
]);

export function normalizeHostname(value?: string | null) {
  const hostname = value?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!hostname) {
    return null;
  }

  const withoutProtocol = hostname.replace(/^https?:\/\//u, "");
  const withoutPath = withoutProtocol.split("/")[0] ?? "";
  const withoutPort =
    withoutPath.startsWith("[") && withoutPath.includes("]")
      ? withoutPath.slice(1, withoutPath.indexOf("]"))
      : withoutPath.split(":")[0];

  return withoutPort || null;
}

export function normalizeCreatorSlug(value?: string | null) {
  const slug = value?.trim().toLowerCase() ?? "";
  return /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/u.test(slug) || /^[a-z0-9]$/u.test(slug)
    ? slug
    : null;
}

export function creatorSlugFromInput(input: { slug?: string | null; displayName?: string | null }) {
  const explicitSlug = normalizeCreatorSlug(slugify(input.slug ?? ""));
  const displayNameSlug = normalizeCreatorSlug(slugify(input.displayName ?? ""));
  return explicitSlug ?? displayNameSlug;
}

export function isReservedCreatorSlug(slug: string) {
  return CREATOR_SLUG_RESERVED_WORDS.has(slug);
}
