import { redirect } from "next/navigation";

import { PipetzBalanceCard } from "@/components/pipetz-balance-card";
import { RedemptionGrid } from "@/components/redemption-grid";
import { ViewerChannelListCard } from "@/components/viewer-channel-list-card";
import { ViewerLinkCard } from "@/components/viewer-link-card";
import { getCatalog, getViewerDashboard, listViewerChannelsForGoogleAccount } from "@/lib/db/repository";
import { requireSession } from "@/lib/auth/session";

export default async function MePage() {
  const session = await requireSession();
  const googleAccountId = session.user!.googleAccountId;
  const [dashboard, catalog, channels] = await Promise.all([
    getViewerDashboard(session.user!.activeViewerId!),
    getCatalog(),
    googleAccountId ? listViewerChannelsForGoogleAccount(googleAccountId) : Promise.resolve([]),
  ]);

  if (!dashboard) {
    redirect("/");
  }

  return (
    <div className="flex w-full flex-col pb-20">
      {/* Balance hero */}
      <PipetzBalanceCard
        displayName={dashboard.viewer.youtubeDisplayName}
        currentBalance={dashboard.balance.currentBalance}
      />

      <ViewerChannelListCard channels={channels} />

      <ViewerLinkCard alreadyLinked={dashboard.viewer.isLinked} />

      <RedemptionGrid
        items={catalog}
        viewerBalance={dashboard.balance.currentBalance}
        expanded
        fullWidth
        sectionClassName="bg-[var(--color-paper-pink)]"
      />
    </div>
  );
}
