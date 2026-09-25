import type { Metadata } from "next";

import { CommunitySectionHeading } from "@/components/community-section-heading";
import { PeriodicMessagesManager } from "@/components/periodic-messages-manager";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";

export const metadata: Metadata = { title: "Mensagens no chat" };

export default async function CommunityMessagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community } = await loadCommunitySection(params, "mensagens");

  return (
    <>
      <CommunitySectionHeading title="Mensagens no chat" description="Lembretes que o chat recebe durante a live, cada um no seu intervalo." />
      <PeriodicMessagesManager creatorId={community.id} defaultOpen />
    </>
  );
}
