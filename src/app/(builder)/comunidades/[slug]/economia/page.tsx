import type { Metadata } from "next";

import { CommunitySectionHeading } from "@/components/community-section-heading";
import { CreatorChatRewardsForm } from "@/components/creator-chat-rewards-form";
import { CreatorEconomyManager } from "@/components/creator-economy-manager";
import { CreatorPageRewardsForm } from "@/components/creator-page-rewards-form";
import { getOwnedChatRewards } from "@/lib/creators/chat-rewards-settings.server";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";
import { getOwnedCurrency } from "@/lib/creators/currency.server";
import { canUseModules, modulesAreAvailable } from "@/lib/creators/module-access";
import { getOwnedPageRewards } from "@/lib/creators/page-rewards.server";

export const metadata: Metadata = { title: "Economia da comunidade" };

export default async function CommunityEconomyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community, tenant, viewerId } = await loadCommunitySection(params, "economia");
  // Chat rewards need the Streamer.bot action; without it the community earns on its page only.
  const hasChat = modulesAreAvailable(tenant, ["streamerbot"]);
  const [chatRewards, pageRewards, currencyLabel] = await Promise.all([
    hasChat ? getOwnedChatRewards(viewerId, community.id).catch(() => undefined) : undefined,
    getOwnedPageRewards(viewerId, community.id).catch(() => undefined),
    getOwnedCurrency(viewerId, community.id)
      .then((result) => result.currencyLabel)
      .catch(() => null),
  ]);
  const canAdjustBalances = currencyLabel !== null && canUseModules(tenant, ["points"], "economy");

  return (
    <>
      <CommunitySectionHeading
        title="Economia"
        description={hasChat
          ? "Como sua comunidade ganha moeda no chat e na página, e os ajustes de saldo de cada espectador."
          : "Como sua comunidade ganha moeda na página e os ajustes de saldo de cada espectador."}
      />
      <div className="grid gap-8">
        <CreatorPageRewardsForm creatorId={community.id} initial={pageRewards} currencyLabel={currencyLabel ?? "moeda"} />
        {hasChat ? <CreatorChatRewardsForm creatorId={community.id} initial={chatRewards} /> : null}
        {canAdjustBalances ? (
          <CreatorEconomyManager creatorId={community.id} currencyLabel={currencyLabel} />
        ) : null}
      </div>
    </>
  );
}
