import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { CommunityInspirations } from "@/components/community-inspirations";
import { OwnerManageLink } from "@/components/owner-manage-link";
import { readCommunityWallet } from "@/lib/creators/community-boosts.server";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { CommunityInspirationAccessError, listCommunityInspirations } from "@/lib/creators/inspirations.server";
import { canUseModules } from "@/lib/creators/module-access";
import { communitySectionPath } from "@/lib/creators/owner-dashboard";
import { getCreatorAreaBySlug } from "@/lib/creators/service";

export default async function CreatorInspirationsPage({ params }: { params: Promise<{ creatorSlug: string }> }) {
  const { creatorSlug } = await params;
  const h = await headers();
  const tenant = await getCreatorAreaBySlug(creatorSlug, { hostname: h.get("x-forwarded-host") ?? h.get("host") });
  if (!tenant) notFound();
  if (tenant.creator.id === DEFAULT_CREATOR_ID) {
    if (!canUseModules(tenant, ["creator_suggestions"])) notFound();
    redirect("/indicacoes");
  }
  if (!canUseModules(tenant, ["creator_suggestions"], "inspirations")) notFound();
  const session = await auth();
  const viewerId = session?.user?.activeViewerId ?? undefined;
  const wallet = await readCommunityWallet(tenant, viewerId);
  let board: Awaited<ReturnType<typeof listCommunityInspirations>> | null = null;
  try { board = await listCommunityInspirations(tenant.creator.id, viewerId); }
  catch (error) { if (error instanceof CommunityInspirationAccessError) notFound(); }
  const path = `/c/${tenant.creator.slug}/inspiracoes`;

  return <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
    <Link href={`/c/${tenant.creator.slug}`} className="font-bold underline">{tenant.creator.displayName}</Link>
    <h1 className="mt-6 break-words text-4xl font-black">Inspirações de {tenant.creator.displayName}</h1>
    <p className="mt-4 max-w-2xl leading-7">Criadores que vale a pena conhecer. Conhece alguém que merece mais gente assistindo? Indique e vote.</p>
    {viewerId && viewerId === tenant.creator.ownerUserId
      ? <OwnerManageLink className="mt-6" href={communitySectionPath(tenant.creator.slug, "inspiracoes")} label="Gerenciar inspirações" /> : null}
    <div className="mt-10">
      {board
        ? <CommunityInspirations slug={tenant.creator.slug} displayName={tenant.creator.displayName} board={board} signedIn={Boolean(viewerId)}
          signInHref={`/api/auth/signin?callbackUrl=${encodeURIComponent(path)}`} wallet={wallet} />
        : <p role="alert">Não foi possível consultar as inspirações agora. Tente novamente mais tarde.</p>}
    </div>
  </div>;
}
