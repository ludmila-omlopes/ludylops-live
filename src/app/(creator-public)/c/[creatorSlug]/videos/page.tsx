import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { CommunityVideos } from "@/components/community-videos";
import { OwnerManageLink } from "@/components/owner-manage-link";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { canUseModules } from "@/lib/creators/module-access";
import { communitySectionPath } from "@/lib/creators/owner-dashboard";
import { getCreatorAreaBySlug } from "@/lib/creators/service";
import { CommunityVideoAccessError, listCommunityVideos } from "@/lib/creators/videos.server";

export default async function CreatorVideosPage({ params }: { params: Promise<{ creatorSlug: string }> }) {
  const { creatorSlug } = await params;
  const h = await headers();
  const tenant = await getCreatorAreaBySlug(creatorSlug, { hostname: h.get("x-forwarded-host") ?? h.get("host") });
  if (!tenant) notFound();
  if (tenant.creator.id === DEFAULT_CREATOR_ID) {
    if (!canUseModules(tenant, ["video_suggestions"])) notFound();
    redirect("/videos");
  }
  if (!canUseModules(tenant, ["video_suggestions"], "videos")) notFound();
  const session = await auth();
  const viewerId = session?.user?.activeViewerId ?? undefined;
  let board: Awaited<ReturnType<typeof listCommunityVideos>> | null = null;
  try { board = await listCommunityVideos(tenant.creator.id, viewerId); }
  catch (error) { if (error instanceof CommunityVideoAccessError) notFound(); }
  const path = `/c/${tenant.creator.slug}/videos`;

  return <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
    <Link href={`/c/${tenant.creator.slug}`} className="font-bold underline">{tenant.creator.displayName}</Link>
    <h1 className="mt-6 break-words text-4xl font-black">Vídeos para {tenant.creator.displayName} reagir</h1>
    <p className="mt-4 max-w-2xl leading-7">Mande o link de um vídeo do YouTube e vote nos que você quer ver na próxima reação.</p>
    {viewerId && viewerId === tenant.creator.ownerUserId
      ? <OwnerManageLink className="mt-6" href={communitySectionPath(tenant.creator.slug, "videos")} label="Gerenciar vídeos" /> : null}
    <div className="mt-10">
      {board
        ? <CommunityVideos slug={tenant.creator.slug} board={board} signedIn={Boolean(viewerId)}
          signInHref={`/api/auth/signin?callbackUrl=${encodeURIComponent(path)}`} />
        : <p role="alert">Não foi possível consultar os vídeos agora. Tente novamente mais tarde.</p>}
    </div>
  </div>;
}
