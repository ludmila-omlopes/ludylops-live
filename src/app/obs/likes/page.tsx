import { requireModulePage } from '@/lib/creators/module-page-access';
import { ObsLikeGoalOverlay } from "@/components/obs-like-goal-overlay";
import { resolveObsOverlayInitialStyle } from "@/lib/obs-overlay-settings";

export default async function ObsLikesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModulePage(["points","obs_overlays"]);

  return <ObsLikeGoalOverlay initialStyle={await resolveObsOverlayInitialStyle(searchParams)} />;
}
