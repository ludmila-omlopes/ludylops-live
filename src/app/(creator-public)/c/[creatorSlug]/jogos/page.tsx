import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { CommunityGames } from "@/components/community-games";
import { OwnerManageLink } from "@/components/owner-manage-link";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { CommunityGameAccessError, listCommunityGames } from "@/lib/creators/games.server";
import { canUseModules } from "@/lib/creators/module-access";
import { communitySectionPath } from "@/lib/creators/owner-dashboard";
import { getCreatorAreaBySlug } from "@/lib/creators/service";

export default async function CreatorGamesPage({ params }: { params: Promise<{ creatorSlug: string }> }) {
  const { creatorSlug } = await params;
  const h = await headers();
  const tenant = await getCreatorAreaBySlug(creatorSlug, { hostname: h.get("x-forwarded-host") ?? h.get("host") });
  if (!tenant) notFound();
  if (tenant.creator.id === DEFAULT_CREATOR_ID) {
    if (!canUseModules(tenant, ["game_suggestions"])) notFound();
    redirect("/jogos");
  }
  if (!canUseModules(tenant, ["game_suggestions"], "games")) notFound();
  const session = await auth();
  const viewerId = session?.user?.activeViewerId ?? undefined;
  let board: Awaited<ReturnType<typeof listCommunityGames>> | null = null;
  try { board = await listCommunityGames(tenant.creator.id, viewerId); }
  catch (error) { if (error instanceof CommunityGameAccessError) notFound(); }
  const path = `/c/${tenant.creator.slug}/jogos`;

  return <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
    <Link href={`/c/${tenant.creator.slug}`} className="font-bold underline">{tenant.creator.displayName}</Link>
    <h1 className="mt-6 break-words text-4xl font-black">Jogos para {tenant.creator.displayName} jogar</h1>
    <p className="mt-4 max-w-2xl leading-7">Sugira um jogo e vote nos que você quer ver jogados.</p>
    {viewerId && viewerId === tenant.creator.ownerUserId
      ? <OwnerManageLink className="mt-6" href={communitySectionPath(tenant.creator.slug, "jogos")} label="Gerenciar jogos" /> : null}
    <div className="mt-10">
      {board
        ? <CommunityGames slug={tenant.creator.slug} board={board} signedIn={Boolean(viewerId)}
          signInHref={`/api/auth/signin?callbackUrl=${encodeURIComponent(path)}`} />
        : <p role="alert">Não foi possível consultar os jogos agora. Tente novamente mais tarde.</p>}
    </div>
  </div>;
}
