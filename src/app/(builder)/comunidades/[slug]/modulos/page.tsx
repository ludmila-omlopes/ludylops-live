import type { Metadata } from "next";

import { CommunityModuleChoicesForm } from "@/components/community-module-choices-form";
import { CommunitySectionHeading } from "@/components/community-section-heading";
import { loadCommunitySection } from "@/lib/creators/community-workspace.server";
import { communityEconomyEnabled } from "@/lib/creators/economy-switch";
import { describeModuleChoices, turnsOnAloneWith } from "@/lib/creators/module-choices";

export const metadata: Metadata = { title: "Módulos da comunidade" };

export default async function CommunityModulesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { community, tenant } = await loadCommunitySection(params, "modulos");

  return (
    <>
      <CommunitySectionHeading
        title="Módulos"
        description="Escolha o que seu público vai encontrar com você. Os módulos marcados como em breve ficam reservados e entram assim que estiverem prontos."
      />
      <CommunityModuleChoicesForm creatorId={community.id} initial={describeModuleChoices(tenant.modules, turnsOnAloneWith(communityEconomyEnabled()))} />
    </>
  );
}
