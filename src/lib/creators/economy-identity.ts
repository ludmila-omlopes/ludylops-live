import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creatorBalances, creatorLedger, economyViewerRedirects, googleAccounts, googleAccountViewers } from "@/lib/db/schema";

export type EconomyTx = Parameters<Parameters<NonNullable<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

// Normal operations share this lock. Identity moves take it exclusively, so an
// in-flight credit either moves with the identity or resolves its new target.
export async function lockEconomyIdentity(tx: EconomyTx, exclusive = false) {
  await tx.execute(exclusive ? sql`select pg_advisory_xact_lock(203, 1)` : sql`select pg_advisory_xact_lock_shared(203, 1)`);
}

export async function canonicalEconomyViewer(tx: EconomyTx, viewerId: string): Promise<string> {
  const seen = new Set<string>();
  while (!seen.has(viewerId)) {
    seen.add(viewerId);
    const [redirect] = await tx.select().from(economyViewerRedirects)
      .where(eq(economyViewerRedirects.sourceViewerId, viewerId));
    if (!redirect) return viewerId;
    viewerId = redirect.targetViewerId;
  }
  throw new Error("economy_identity_cycle");
}

/** Call in the same transaction as the global identity merge/transfer. */
export async function mergeCreatorEconomies(tx: EconomyTx, sourceId: string, targetId: string, reactivateTarget = false) {
  await lockEconomyIdentity(tx, true);
  const source = await canonicalEconomyViewer(tx, sourceId);
  const target = reactivateTarget ? targetId : await canonicalEconomyViewer(tx, targetId);
  if (reactivateTarget) await tx.delete(economyViewerRedirects).where(eq(economyViewerRedirects.sourceViewerId, target));
  if (source === target) return;
  const balances = await tx.select().from(creatorBalances).where(eq(creatorBalances.viewerId, source));
  if (!balances.length) {
    const [entry, alias] = await Promise.all([
      tx.select({ id: creatorLedger.id }).from(creatorLedger).where(eq(creatorLedger.viewerId, source)).limit(1),
      tx.select({ id: economyViewerRedirects.sourceViewerId }).from(economyViewerRedirects).where(eq(economyViewerRedirects.targetViewerId, source)).limit(1),
    ]);
    // Before activation, legacy-only identities need no new persistent references.
    if (!entry.length && !alias.length) return;
  }
  for (const balance of balances) {
    await tx.insert(creatorBalances).values({ ...balance, viewerId: target }).onConflictDoUpdate({
      target: [creatorBalances.creatorId, creatorBalances.viewerId],
      set: {
        currentBalance: sql`${creatorBalances.currentBalance} + ${balance.currentBalance}`,
        lifetimeEarned: sql`${creatorBalances.lifetimeEarned} + ${balance.lifetimeEarned}`,
        lifetimeSpent: sql`${creatorBalances.lifetimeSpent} + ${balance.lifetimeSpent}`,
        updatedAt: new Date(),
      },
    });
  }
  await tx.delete(creatorBalances).where(eq(creatorBalances.viewerId, source));
  await tx.update(creatorLedger).set({ viewerId: target }).where(eq(creatorLedger.viewerId, source));
  await tx.update(economyViewerRedirects).set({ targetViewerId: target }).where(eq(economyViewerRedirects.targetViewerId, source));
  await tx.insert(economyViewerRedirects).values({ sourceViewerId: source, targetViewerId: target })
    .onConflictDoUpdate({ target: economyViewerRedirects.sourceViewerId, set: { targetViewerId: target } });
}

/** Honor accounts already linked before the new currency tables existed. */
export async function creditedEconomyViewer(tx: EconomyTx, viewerId: string) {
  const canonical = await canonicalEconomyViewer(tx, viewerId);
  const [account] = await tx.select({ activeViewerId: googleAccounts.activeViewerId })
    .from(googleAccountViewers).innerJoin(googleAccounts, eq(googleAccounts.id, googleAccountViewers.googleAccountId))
    .where(eq(googleAccountViewers.viewerId, canonical));
  return account?.activeViewerId ? canonicalEconomyViewer(tx, account.activeViewerId) : canonical;
}

export async function consolidateAccountEconomies(tx: EconomyTx, accountId: string, targetId: string) {
  await lockEconomyIdentity(tx, true);
  await mergeCreatorEconomies(tx, targetId, targetId, true);
  const links = await tx.select({ viewerId: googleAccountViewers.viewerId }).from(googleAccountViewers)
    .where(eq(googleAccountViewers.googleAccountId, accountId));
  for (const link of links) if (link.viewerId !== targetId) await mergeCreatorEconomies(tx, link.viewerId, targetId, true);
}
