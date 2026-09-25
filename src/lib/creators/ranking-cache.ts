import { cachePublicCreatorRead } from "@/lib/cache";
import { requireCreatorContext, type CreatorContext } from "./context";
import { loadModuleTenant } from "./module-access";
import { canReadCreatorRanking, CreatorRankingUnavailableError, readCreatorRanking } from "./ranking";

const cachedRanking = cachePublicCreatorRead("ranking", 15, (context, limit: number) => readCreatorRanking(context, limit));

/** Page-only public data cache. Neither the resolver nor module/lifecycle authorization is cached. */
export async function readPublicCreatorRanking(context: CreatorContext, limit = 100) {
  requireCreatorContext(context);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("invalid_ranking_limit");
  if (!canReadCreatorRanking(await loadModuleTenant(context))) throw new CreatorRankingUnavailableError();
  return cachedRanking(context, limit);
}
