import type { Metadata } from "next";

import { CommunitySectionHeading } from "@/components/community-section-heading";
import { CreatorCurrencyForm } from "@/components/creator-currency-form";
import { CreatorProfileForm } from "@/components/creator-profile-form";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";
import { getOwnedCurrency } from "@/lib/creators/currency.server";
import { getOwnedCreatorProfile } from "@/lib/creators/profile.server";
import { modulesAreAvailable } from "@/lib/creators/module-access";

export const metadata: Metadata = { title: "Identidade da comunidade" };

export default async function CommunityIdentityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community, tenant, viewerId } = await loadCommunitySection(params, "identidade");
  const hasCurrency = modulesAreAvailable(tenant, ["points"]);
  const [profile, currency] = await Promise.all([
    getOwnedCreatorProfile(viewerId, community.id).catch(() => undefined),
    hasCurrency ? getOwnedCurrency(viewerId, community.id)
      .then((result) => result.currencyLabel)
      .catch(() => null) : null,
  ]);

  return (
    <>
      <CommunitySectionHeading
        title="Identidade"
        description={hasCurrency ? "O nome, as cores e a moeda que sua comunidade encontra durante a live." : "O nome e as cores que seu público vai reconhecer."}
      />
      <div className="grid gap-6">
        <CreatorProfileForm creatorId={community.id} initial={profile} />
        {currency !== null ? <CreatorCurrencyForm creatorId={community.id} initial={currency} /> : null}
      </div>
    </>
  );
}
