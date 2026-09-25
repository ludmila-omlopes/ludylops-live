import type { Metadata } from "next";

import { AdminRedemptionsPanel } from "@/components/admin-redemptions-panel";
import { CommunitySectionHeading } from "@/components/community-section-heading";
import { CreatorCatalogManager } from "@/components/creator-catalog";
import { CreatorIntegrationOperations } from "@/components/creator-integration-operations";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";
import { listCreatorCatalog, listCreatorRedemptions } from "@/lib/creators/redemptions.server";

export const metadata: Metadata = { title: "Resgates da comunidade" };

export default async function CommunityRedemptionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community, viewerId } = await loadCommunitySection(params, "resgates");
  const scope = { kind: "owner" as const, viewerId };
  const data = await Promise.all([
    listCreatorCatalog(community.id, scope),
    listCreatorRedemptions(community.id, scope),
  ]).catch(() => null);

  return (
    <>
      <CommunitySectionHeading
        title="Resgates"
        description="Os itens que sua comunidade troca pela moeda e o que acontece com cada resgate na live."
      />
      {data ? (
        <div className="grid gap-8">
          <CreatorCatalogManager items={data[0].items} creatorId={community.id} currencyLabel={data[0].currencyLabel} />
          <CreatorIntegrationOperations creatorId={community.id} />
          <AdminRedemptionsPanel entries={data[1]} currencyLabel={data[0].currencyLabel} />
        </div>
      ) : (
        <p role="alert">Os resgates estão indisponíveis no momento. Tente novamente mais tarde.</p>
      )}
    </>
  );
}
