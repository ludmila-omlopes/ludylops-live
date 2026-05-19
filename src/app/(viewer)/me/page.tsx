import { redirect } from "next/navigation";

import { PipetzBalanceCard } from "@/components/pipetz-balance-card";
import { RedemptionGrid } from "@/components/redemption-grid";
import { ViewerLinkCard } from "@/components/viewer-link-card";
import { getCatalog, getViewerDashboard } from "@/lib/db/repository";
import { requireSession } from "@/lib/auth/session";

export default async function MePage() {
  const session = await requireSession();
  const [dashboard, catalog] = await Promise.all([
    getViewerDashboard(session.user!.activeViewerId!),
    getCatalog(),
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

      {dashboard.viewer.isLinked ? null : <ViewerLinkCard />}

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
