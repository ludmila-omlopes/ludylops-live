import { unstable_cache } from "next/cache";
import { isDemoMode } from "@/lib/env";
import { requireCreatorContext, type CreatorContext } from "@/lib/creators/context";

type Dimension = string | number | boolean | null;

/** Public, already-isolated loaders only. Callers must authorize every request before using this wrapper. */
export function cachePublicCreatorRead<Args extends Dimension[], Result>(
  resource: string,
  ttlSeconds: number,
  loader: (context: CreatorContext, ...dimensions: Args) => Promise<Result>,
) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(resource) || !Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 60)
    throw new Error("invalid_public_cache_policy");
  return async (context: CreatorContext, ...dimensions: Args): Promise<Result> => {
    const creatorId = requireCreatorContext(context);
    if (creatorId.length > 64 || dimensions.length > 8 || dimensions.some((value) =>
      !(value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.length <= 256))))
      throw new Error("invalid_public_cache_key");
    if (isDemoMode) return loader({ creatorId }, ...dimensions);
    return unstable_cache(
      (scopedCreatorId: string, ...query: Args) => loader({ creatorId: scopedCreatorId }, ...query),
      ["creator-public-v1", resource, creatorId, String(ttlSeconds)],
      { revalidate: ttlSeconds, tags: [`creator:${creatorId}`, `creator:${creatorId}:${resource}`] },
    )(creatorId, ...dimensions);
  };
}
