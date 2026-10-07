import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { CommunityBets } from "@/components/community-bets";
import { OwnerManageLink } from "@/components/owner-manage-link";
import { CommunityBetAccessError, listCommunityBets } from "@/lib/creators/bets.server";
import { readCommunityWallet } from "@/lib/creators/community-boosts.server";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { communityEconomyEnabled } from "@/lib/creators/economy-switch";
import { canUseModules } from "@/lib/creators/module-access";
import { communitySectionPath } from "@/lib/creators/owner-dashboard";
import { getCreatorAreaBySlug } from "@/lib/creators/service";

export default async function CreatorBetsPage({ params }: { params: Promise<{ creatorSlug: string }> }) {
  const { creatorSlug } = await params;
  const h = await headers();
  const tenant = await getCreatorAreaBySlug(creatorSlug, { hostname: h.get("x-forwarded-host") ?? h.get("host") });
  if (!tenant) notFound();
  if (tenant.creator.id === DEFAULT_CREATOR_ID) {
    if (!canUseModules(tenant, ["bets"])) notFound();
    redirect("/apostas");
  }
  // Bets move the community currency, so they follow its switch too.
  if (!communityEconomyEnabled() || !canUseModules(tenant, ["bets"], "bets")) notFound();
  const session = await auth();
  const viewerId = session?.user?.activeViewerId ?? undefined;
  const wallet = await readCommunityWallet(tenant, viewerId);
  let board: Awaited<ReturnType<typeof listCommunityBets>> | null = null;
  try { board = await listCommunityBets(tenant.creator.id, viewerId); }
  catch (error) { if (error instanceof CommunityBetAccessError) notFound(); }
  const path = `/c/${tenant.creator.slug}/apostas`;

  return <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
    <Link href={`/c/${tenant.creator.slug}`} className="font-bold underline">{tenant.creator.displayName}</Link>
    <h1 className="mt-6 break-words text-4xl font-black">Apostas da comunidade de {tenant.creator.displayName}</h1>
    <p className="mt-4 max-w-2xl leading-7">
      Escolha um palpite e aposte {wallet?.currencyLabel ?? "a moeda da comunidade"}. Quem acerta divide o pote; se ninguém acertar, todo mundo recebe de volta.
    </p>
    {viewerId && viewerId === tenant.creator.ownerUserId
      ? <OwnerManageLink className="mt-6" href={communitySectionPath(tenant.creator.slug, "apostas")} label="Gerenciar apostas" /> : null}
    <div className="mt-10">
      {board
        ? <CommunityBets slug={tenant.creator.slug} board={board} signedIn={Boolean(viewerId)}
          signInHref={`/api/auth/signin?callbackUrl=${encodeURIComponent(path)}`} wallet={wallet} />
        : <p role="alert">Não foi possível consultar as apostas agora. Tente novamente mais tarde.</p>}
    </div>
  </div>;
}
