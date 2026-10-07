import { canUseModules } from "./module-access";
import { resolvePublicCreatorFromRequest } from "./tenant";

export async function resolveStickerTenant(request: Request) {
  const slugs = new URL(request.url).searchParams.getAll("creator");
  if (slugs.length > 1) return null;
  const tenant = await resolvePublicCreatorFromRequest({ request, pathname: "/", ...(slugs.length ? { slug: slugs[0] } : {}) });
  return canUseModules(tenant, ["obs_overlays"], "obs.stickers") ? tenant : null;
}
