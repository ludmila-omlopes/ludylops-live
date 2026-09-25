import type { Metadata } from "next";

import { CommunitySectionHeading } from "@/components/community-section-heading";
import { CreatorChatRewardsForm } from "@/components/creator-chat-rewards-form";
import { CreatorEconomyManager } from "@/components/creator-economy-manager";
import { getOwnedChatRewards } from "@/lib/creators/chat-rewards-settings.server";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";
import { getOwnedCurrency } from "@/lib/creators/currency.server";
import { canUseModules } from "@/lib/creators/module-access";

export const metadata: Metadata = { title: "Economia da comunidade" };

export default async function CommunityEconomyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community, tenant, viewerId } = await loadCommunitySection(params, "economia");
  const [chatRewards, currencyLabel] = await Promise.all([
    getOwnedChatRewards(viewerId, community.id).catch(() => undefined),
    getOwnedCurrency(viewerId, community.id)
      .then((result) => result.currencyLabel)
      .catch(() => null),
  ]);
  const canAdjustBalances = currencyLabel !== null && canUseModules(tenant, ["points"], "economy");

  return (
    <>
      <CommunitySectionHeading
        title="Economia"
        description="Como sua comunidade ganha moeda no chat e os ajustes de saldo de cada espectador."
      />
      <div className="grid gap-8">
        <CreatorChatRewardsForm creatorId={community.id} initial={chatRewards} />
        {canAdjustBalances ? (
          <section className="grid gap-4 border-t-2 border-[var(--color-ink)] pt-6">
            <h2 className="text-2xl font-bold">Saldos dos espectadores</h2>
            <CreatorEconomyManager creatorId={community.id} currencyLabel={currencyLabel} />
          </section>
        ) : null}
      </div>
    </>
  );
}
