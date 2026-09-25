import { DEFAULT_CREATOR_DOMAIN } from "@/lib/creators/defaults";
import { isReservedCreatorSlug, normalizeCreatorSlug, normalizePublicHostname } from "@/lib/creators/identity";

/** Routing only. The destination page still verifies the registered domain and creator status. */
export function getCreatorRootPath(request: Request): string | null {
  const url = new URL(request.url);
  if (url.pathname !== "/") return null;

  // Match the public resolver's precedence. The deployment must control this header.
  const hostname = normalizePublicHostname(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host,
  );
  const suffix = `.${DEFAULT_CREATOR_DOMAIN}`;
  if (!hostname?.endsWith(suffix)) return null;

  const slug = normalizeCreatorSlug(hostname.slice(0, -suffix.length));
  return slug && !isReservedCreatorSlug(slug) ? `/c/${slug}` : null;
}
