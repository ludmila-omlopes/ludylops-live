import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { CreatorCatalog, CreatorCatalogManager } from "@/components/creator-catalog";
import { AdminRedemptionsPanel } from "@/components/admin-redemptions-panel";
import { getCreatorAreaBySlug } from "@/lib/creators/service";
import { canUseModules } from "@/lib/creators/module-access";
import { listCreatorCatalog, listCreatorRedemptions } from "@/lib/creators/redemptions.server";
import { publicCatalogItem } from "@/lib/creators/redemptions";
import { readCreatorEconomy } from "@/lib/creators/economy";

export default async function CreatorRedemptionsPage({ params }: { params: Promise<{ creatorSlug: string }> }) {
  const { creatorSlug } = await params, requestHeaders = await headers();
  const tenant = await getCreatorAreaBySlug(creatorSlug, { hostname: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") });
  if (!tenant || !canUseModules(tenant, ["redemptions"], "redemptions")) notFound();
  const session = await auth(), viewerId = session?.user?.activeViewerId;
  const owner = Boolean(viewerId && viewerId === tenant.creator.ownerUserId);
  let data: { catalog: Awaited<ReturnType<typeof listCreatorCatalog>>; balance: Awaited<ReturnType<typeof readCreatorEconomy>> | null; entries: Awaited<ReturnType<typeof listCreatorRedemptions>> | null } | null = null;
  try {
    const catalog = await listCreatorCatalog(tenant.creator.id, owner ? { kind: "owner", viewerId: viewerId! } : { kind: "public" });
    const balance = viewerId ? await readCreatorEconomy({ creatorId: tenant.creator.id }, { kind: "viewer", viewerId }, viewerId) : null;
    const entries = viewerId ? await listCreatorRedemptions(tenant.creator.id, { kind: owner ? "owner" : "viewer", viewerId }) : null;
    data = { catalog, balance, entries };
  } catch { /* Missing migration or unavailable modules: render a clear unavailable state. */ }
  const content = data ? (() => { const { catalog, balance, entries } = data; return <>
      {balance && <p className="text-xl font-bold">Seu saldo: {balance.balance.currentBalance.toLocaleString("pt-BR")} {catalog.currencyLabel}</p>}
      <CreatorCatalog items={catalog.items.filter((i) => i.isActive).map(publicCatalogItem)} slug={creatorSlug} currencyLabel={catalog.currencyLabel} signedIn={Boolean(viewerId)} />
      {owner && <CreatorCatalogManager items={catalog.items} creatorId={tenant.creator.id} currencyLabel={catalog.currencyLabel} />}
      {entries && <AdminRedemptionsPanel entries={entries} currencyLabel={catalog.currencyLabel} viewerMode={!owner} />}
    </>; })() : <p role="alert">Os resgates estão indisponíveis no momento. Tente novamente mais tarde.</p>;
  return <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6">
    <Link href={`/c/${creatorSlug}`} className="font-bold underline">{tenant.creator.displayName}</Link>
    <h1 className="text-4xl font-black">Resgates da live</h1>{content}
  </div>;
}
