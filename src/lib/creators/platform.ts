// Nome provisório da plataforma white label. O nome definitivo ainda não foi
// decidido: quando for, trocar apenas esta constante.
export const PLATFORM_NAME = "Creator Hub";

// Existing production alias, independent of the community's APP_URL.
export function getPlatformOrigin() {
  const value = process.env.NEXT_PUBLIC_PLATFORM_URL ?? "https://ludylops-youtube-dashboard.vercel.app";
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("invalid_platform_origin");
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("invalid_platform_origin");
  return url.origin;
}

export function creatorPlatformUrl(slug: string) {
  return `${getPlatformOrigin()}/c/${encodeURIComponent(slug)}`;
}

export type CreatorLandingState = "visitor" | "closed_beta" | "approved";

export function resolveCreatorLandingState(input: {
  hasUsableSession: boolean;
  canCreateArea: boolean;
}): CreatorLandingState {
  if (!input.hasUsableSession) {
    return "visitor";
  }
  return input.canCreateArea ? "approved" : "closed_beta";
}
