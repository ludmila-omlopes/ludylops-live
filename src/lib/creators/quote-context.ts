import { resolvePublicCreatorFromRequest } from "@/lib/creators/tenant";

/** Public routing input is validated against the creator/domain registry, not used as admin authority. */
export async function resolveQuoteRequest(request: Request, pathSlug?: string) {
  const slugs = new URL(request.url).searchParams.getAll("creator");
  if (slugs.length > 1 || (pathSlug !== undefined && slugs.length && slugs[0] !== pathSlug)) return null;
  const slug = pathSlug ?? slugs[0];
  const tenant = await resolvePublicCreatorFromRequest({
    request,
    pathname: "/quotes",
    ...(slug !== undefined ? { slug } : {}),
  });
  if (!tenant?.modules.some(module => module.moduleKey === "quotes" && module.status === "installed")) return null;
  return tenant;
}
