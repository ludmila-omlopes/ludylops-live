import { DEFAULT_CREATOR_DOMAIN } from "./defaults";
import { normalizePublicHostname } from "./identity";
import { getPlatformOrigin } from "./platform";

export function isLegacyCommunityHost(hostname: string | null) {
  return hostname === DEFAULT_CREATOR_DOMAIN || hostname === `www.${DEFAULT_CREATOR_DOMAIN}`;
}

export function platformHostnames() {
  const hosts = new Set(["localhost", "127.0.0.1", "::1", new URL(getPlatformOrigin()).hostname]);
  for (const value of [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (!value) continue;
    try {
      const url = new URL(value.includes("://") ? value : `https://${value}`);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) continue;
      const hostname = normalizePublicHostname(url.host);
      if (hostname && !isLegacyCommunityHost(hostname)) hosts.add(hostname);
    } catch { /* Invalid configuration never broadens host authorization. */ }
  }
  hosts.delete(DEFAULT_CREATOR_DOMAIN);
  hosts.delete(`www.${DEFAULT_CREATOR_DOMAIN}`);
  return hosts;
}

export function isPlatformHost(hostname: string | null) {
  return Boolean(hostname && platformHostnames().has(hostname));
}

export function requestHostname(request: Request) {
  return normalizePublicHostname(request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host);
}
