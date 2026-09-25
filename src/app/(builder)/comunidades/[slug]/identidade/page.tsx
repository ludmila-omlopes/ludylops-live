import type { Metadata } from "next";

import { CommunitySectionHeading } from "@/components/community-section-heading";
import { CreatorCurrencyForm } from "@/components/creator-currency-form";
import { CreatorProfileForm } from "@/components/creator-profile-form";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";
import { getOwnedCurrency } from "@/lib/creators/currency.server";
import { getOwnedCreatorProfile } from "@/lib/creators/profile.server";

export const metadata: Metadata = { title: "Identidade da comunidade" };

export default async function CommunityIdentityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community, viewerId } = await loadCommunitySection(params, "identidade");
  const [profile, currency] = await Promise.all([
    getOwnedCreatorProfile(viewerId, community.id).catch(() => undefined),
    getOwnedCurrency(viewerId, community.id)
      .then((result) => result.currencyLabel)
      .catch(() => null),
  ]);

  return (
    <>
      <CommunitySectionHeading
        title="Identidade"
        description="O nome, as cores e a moeda que sua comunidade encontra durante a live."
      />
      <div className="grid gap-6">
        <CreatorProfileForm creatorId={community.id} initial={profile} />
        {currency !== null ? <CreatorCurrencyForm creatorId={community.id} initial={currency} /> : null}
      </div>
    </>
  );
}
