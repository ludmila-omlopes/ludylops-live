import { notFound, redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { isCommunitySectionAvailable } from "@/lib/creators/community-sections";
import { communityDashboardPath, type CommunitySectionKey } from "@/lib/creators/owner-dashboard";
import { getOwnedCommunityWorkspace } from "@/lib/creators/owner-dashboard.server";

export const LEGACY_ADMIN_URL = "https://ludylops.live/admin";

/**
 * Shared guard for every /comunidades/[slug] route: session, ownership (404 otherwise),
 * Ludylops hand-off and section availability.
 */
export async function loadCommunitySection(params: Promise<{ slug: string }>, section: CommunitySectionKey) {
  const session = await requireSession();
  const viewerId = session.user!.activeViewerId!;
  const { slug } = await params;
  const workspace = await getOwnedCommunityWorkspace(viewerId, slug);

  if (!workspace) {
    notFound();
  }
  if (workspace.community.isLegacy) {
    redirect(LEGACY_ADMIN_URL);
  }
  if (!isCommunitySectionAvailable(workspace.tenant, section)) {
    redirect(communityDashboardPath(workspace.community.slug));
  }

  return { ...workspace, viewerId };
}
