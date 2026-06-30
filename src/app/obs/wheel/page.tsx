import { ObsWheelOverlay } from "@/components/obs-wheel-overlay";
import { resolveObsOverlayInitialStyle } from "@/lib/obs-overlay-settings";

export default async function ObsWheelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ObsWheelOverlay initialStyle={await resolveObsOverlayInitialStyle(searchParams)} />;
}
