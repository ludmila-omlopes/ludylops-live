import type { Metadata } from "next";

import { CommunityBetsManager } from "@/components/community-bets-manager";
import { CommunitySectionHeading } from "@/components/community-section-heading";
import { listOwnedCommunityBets } from "@/lib/creators/bets.server";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";

export const metadata: Metadata = { title: "Apostas" };

export default async function CommunityBetsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community, viewerId } = await loadCommunitySection(params, "apostas");
  const board = await listOwnedCommunityBets(community.id, viewerId).catch(() => null);

  return (
    <>
      <CommunitySectionHeading
        title="Apostas"
        description="Abra uma pergunta com até seis palpites e deixe seu público apostar a moeda da comunidade. Encerre as apostas quando quiser e defina o resultado para pagar quem acertou."
      />
      {board
        ? <CommunityBetsManager creatorId={community.id} initial={board} />
        : <p role="alert" className="text-sm">Não foi possível consultar as apostas agora. Tente novamente em instantes.</p>}
    </>
  );
}
