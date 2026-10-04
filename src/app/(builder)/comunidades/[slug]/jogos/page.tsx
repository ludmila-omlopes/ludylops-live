import type { Metadata } from "next";

import { CommunityGamesManager } from "@/components/community-games-manager";
import { CommunitySectionHeading } from "@/components/community-section-heading";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";
import { listOwnedCommunityGames } from "@/lib/creators/games.server";

export const metadata: Metadata = { title: "Jogos" };

export default async function CommunityGamesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community, viewerId } = await loadCommunitySection(params, "jogos");
  const board = await listOwnedCommunityGames(community.id, viewerId).catch(() => null);

  return (
    <>
      <CommunitySectionHeading
        title="Jogos"
        description="Os jogos que seu público sugeriu, dos mais votados para os menos. Escolha o que vai jogar, marque o que já jogou e recuse o que não combina com você."
      />
      {board
        ? <CommunityGamesManager creatorId={community.id} initial={board} />
        : <p role="alert" className="text-sm">Não foi possível consultar os jogos agora. Tente novamente em instantes.</p>}
    </>
  );
}
