import { requireModulePage } from '@/lib/creators/module-page-access';
import { ObsWheelOverlay } from "@/components/obs-wheel-overlay";
import { resolveObsOverlayInitialStyle } from "@/lib/obs-overlay-settings";

export default async function ObsWheelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModulePage(["obs_overlays"]);

  return <ObsWheelOverlay initialStyle={await resolveObsOverlayInitialStyle(searchParams)} />;
}
