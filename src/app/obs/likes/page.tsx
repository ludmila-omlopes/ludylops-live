import { ObsLikeGoalOverlay } from "@/components/obs-like-goal-overlay";
import { resolveObsOverlayInitialStyle } from "@/lib/obs-overlay-settings";

export default async function ObsLikesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ObsLikeGoalOverlay initialStyle={await resolveObsOverlayInitialStyle(searchParams)} />;
}
