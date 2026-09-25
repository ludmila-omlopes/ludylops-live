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
  "owner",
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

/** Strict request-host parsing, shared by public resolution and wildcard routing. */
export function normalizePublicHostname(value?: string | null) {
  const host = value?.split(",")[0]?.trim().toLowerCase();
  if (!host || !/^(?:\[::1\]|::1|[a-z0-9-]+(?:\.[a-z0-9-]+)*)(?::[0-9]+)?$/u.test(host)) return null;
  const hostname = host === "::1" ? host : normalizeHostname(host);
  if (hostname !== "::1" && hostname?.split(".").some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))) return null;
  if (host !== "::1") {
    try { new URL(`http://${host}`); } catch { return null; }
  }
  return hostname;
}

export function creatorSlugFromInput(input: { slug?: string | null; displayName?: string | null }) {
  const explicitSlug = normalizeCreatorSlug(slugify(input.slug ?? ""));
  const displayNameSlug = normalizeCreatorSlug(slugify(input.displayName ?? ""));
  return explicitSlug ?? displayNameSlug;
}

export function isReservedCreatorSlug(slug: string) {
  return CREATOR_SLUG_RESERVED_WORDS.has(slug);
}
