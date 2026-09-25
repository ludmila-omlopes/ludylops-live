import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creatorBalances, creatorModules, creators, users } from "@/lib/db/schema";
import { env, isDemoMode } from "@/lib/env";
import { getDistinctYoutubeHandle } from "@/lib/youtube/identity";
import { requireCreatorContext, type CreatorContext } from "./context";
import { getCurrencyLabel } from "./currency";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import { economyDemoStore } from "./economy-demo";
import { lockEconomyIdentity } from "./economy-identity";
import { canUseModules } from "./module-access";

export type CreatorRankingEntry = { position: number; displayName: string; handle: string | null; currentBalance: number };
export type CreatorRanking = { currencyLabel: string; entries: CreatorRankingEntry[] };
export class CreatorRankingUnavailableError extends Error {
  constructor() { super("ranking_unavailable"); }
}

export function canReadCreatorRanking(tenant: Parameters<typeof canUseModules>[0]) {
  return (isDemoMode || env.CREATOR_ECONOMY_ENABLED === "true")
    && canUseModules(tenant, ["ranking"], "ranking.read");
}

type PublicRow = { youtubeDisplayName: string; youtubeHandle: string | null; currentBalance: number };
function publicEntries(rows: PublicRow[]): CreatorRankingEntry[] {
  // Keep public output explicit: no email, account IDs, ledger, lifetime totals or sync metadata.
  return rows.map((row, index) => ({ position: index + 1, displayName: row.youtubeDisplayName,
    handle: getDistinctYoutubeHandle(row), currentBalance: row.currentBalance }));
}

/** Only the community's public balances, bounded in SQL; never falls back to pipetz/demo on storage failure. */
export async function readCreatorRanking(context: CreatorContext, limit = 100): Promise<CreatorRanking> {
  const creatorId = requireCreatorContext(context);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("invalid_ranking_limit");
  if (creatorId === DEFAULT_CREATOR_ID || (!isDemoMode && env.CREATOR_ECONOMY_ENABLED !== "true"))
    throw new CreatorRankingUnavailableError();
  if (isDemoMode) {
    const tenant = listDemoCreatorTenants().find((t) => t.creator.id === creatorId) ?? null;
    if (!canReadCreatorRanking(tenant)) throw new CreatorRankingUnavailableError();
    const viewers = new Map(globalThis.__lojaDemoStore?.viewers.map((v) => [v.id, v]));
    const rows = Object.entries(economyDemoStore().balances).flatMap(([key, balance]) => {
      const [owner, viewerId] = JSON.parse(key) as [string, string];
      if (owner !== creatorId || balance.currentBalance <= 0) return [];
      const viewer = viewers.get(viewerId);
      if (!viewer || viewer.excludeFromRanking || !/^UC[A-Za-z0-9_-]{22}$/.test(viewer.youtubeChannelId)) return [];
      return [{ youtubeChannelId: viewer.youtubeChannelId, youtubeDisplayName: viewer.youtubeDisplayName,
        youtubeHandle: viewer.youtubeHandle ?? null, currentBalance: balance.currentBalance }];
    }).sort((a, b) => b.currentBalance - a.currentBalance
      || (a.youtubeChannelId < b.youtubeChannelId ? -1 : a.youtubeChannelId > b.youtubeChannelId ? 1 : 0)).slice(0, limit);
    return { currencyLabel: getCurrencyLabel(tenant!.modules.find((m) => m.moduleKey === "points")?.configJson), entries: publicEntries(rows) };
  }
  const db = getDb();
  if (!db) throw new Error("ranking_storage_unavailable");
  return db.transaction(async (tx) => {
    await lockEconomyIdentity(tx);
    const [creator] = await tx.select({ id: creators.id, status: creators.status }).from(creators)
      .where(eq(creators.id, creatorId)).for("share");
    const modules = await tx.select().from(creatorModules)
      .where(and(eq(creatorModules.creatorId, creatorId), inArray(creatorModules.moduleKey, ["ranking", "points"]))).for("share");
    if (!creator || !canReadCreatorRanking({ creator, modules })) throw new CreatorRankingUnavailableError();
    const rows = await tx.select({ youtubeDisplayName: users.youtubeDisplayName, youtubeHandle: users.youtubeHandle,
      currentBalance: creatorBalances.currentBalance }).from(creatorBalances)
      .innerJoin(users, eq(users.id, creatorBalances.viewerId))
      .where(and(eq(creatorBalances.creatorId, creatorId), gt(creatorBalances.currentBalance, 0),
        eq(users.excludeFromRanking, false), sql`${users.youtubeChannelId} ~ '^UC[A-Za-z0-9_-]{22}$'`))
      .orderBy(desc(creatorBalances.currentBalance), sql`${users.youtubeChannelId} collate "C" asc`).limit(limit);
    return { currencyLabel: getCurrencyLabel(modules.find((m) => m.moduleKey === "points")?.configJson as Record<string, unknown> | undefined),
      entries: publicEntries(rows) };
  }, { isolationLevel: "repeatable read" });
}
