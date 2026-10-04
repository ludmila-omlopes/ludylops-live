import type { Metadata } from "next";

import { CommunityInspirationsManager } from "@/components/community-inspirations-manager";
import { CommunitySectionHeading } from "@/components/community-section-heading";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";
import { listOwnedCommunityInspirations } from "@/lib/creators/inspirations.server";

export const metadata: Metadata = { title: "Inspirações" };

export default async function CommunityInspirationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community, viewerId } = await loadCommunitySection(params, "inspiracoes");
  const board = await listOwnedCommunityInspirations(community.id, viewerId).catch(() => null);

  return (
    <>
      <CommunitySectionHeading
        title="Inspirações"
        description="Os criadores que você recomenda e os que seu público indicou. Destaque quem merece ser conhecido e recuse o que não combina com você."
      />
      {board
        ? <CommunityInspirationsManager creatorId={community.id} initial={board} />
        : <p role="alert" className="text-sm">Não foi possível consultar as inspirações agora. Tente novamente em instantes.</p>}
    </>
  );
}
