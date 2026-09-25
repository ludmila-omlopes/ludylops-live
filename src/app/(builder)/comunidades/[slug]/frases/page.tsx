import type { Metadata } from "next";

import { CommunitySectionHeading } from "@/components/community-section-heading";
import { CreatorQuoteManager } from "@/components/creator-quote-manager";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";

export const metadata: Metadata = { title: "Frases da comunidade" };

export default async function CommunityQuotesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community } = await loadCommunitySection(params, "frases");

  return (
    <>
      <CommunitySectionHeading title="Frases" description="As frases que marcaram as lives, prontas para voltar ao chat." />
      <CreatorQuoteManager creatorId={community.id} defaultOpen />
    </>
  );
}
