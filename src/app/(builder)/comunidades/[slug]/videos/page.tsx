import type { Metadata } from "next";

import { CommunitySectionHeading } from "@/components/community-section-heading";
import { CommunityVideosManager } from "@/components/community-videos-manager";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";
import { listOwnedCommunityVideos } from "@/lib/creators/videos.server";

export const metadata: Metadata = { title: "Vídeos para reagir" };

export default async function CommunityVideosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community, viewerId } = await loadCommunitySection(params, "videos");
  const board = await listOwnedCommunityVideos(community.id, viewerId).catch(() => null);

  return (
    <>
      <CommunitySectionHeading
        title="Vídeos para reagir"
        description="Os vídeos que seu público mandou, dos mais votados para os menos. Marque os que ganharam reação e recuse os que não combinam com você."
      />
      {board
        ? <CommunityVideosManager creatorId={community.id} initial={board} />
        : <p role="alert" className="text-sm">Não foi possível consultar os vídeos agora. Tente novamente em instantes.</p>}
    </>
  );
}
