import type { Metadata } from "next";

import { CommunitySectionHeading } from "@/components/community-section-heading";
import { CreatorRecommendationManager } from "@/components/creator-recommendation-manager";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";

export const metadata: Metadata = { title: "Produtos da comunidade" };

export default async function CommunityProductsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community } = await loadCommunitySection(params, "produtos");

  return (
    <>
      <CommunitySectionHeading title="Produtos" description="As indicações de setup, jogos e dia a dia que você compartilha com a comunidade." />
      <CreatorRecommendationManager creatorId={community.id} defaultOpen />
    </>
  );
}
