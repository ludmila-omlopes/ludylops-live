import type { Metadata } from "next";

import { CommunitySectionHeading } from "@/components/community-section-heading";
import { CreatorSetupGuides } from "@/components/creator-setup";
import { StreamerbotCredentials } from "@/components/streamerbot-credentials";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";

export const metadata: Metadata = { title: "Integração com o Streamer.bot" };

export default async function CommunityIntegrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community } = await loadCommunitySection(params, "integracao");

  return (
    <>
      <CommunitySectionHeading
        title="Integração"
        description="A credencial que liga o seu Streamer.bot à sua comunidade durante a live."
      />
      <div className="grid gap-8">
        <StreamerbotCredentials creatorId={community.id} enabled={community.status === "active"} mode="creator" defaultOpen />
        <CreatorSetupGuides />
      </div>
    </>
  );
}
