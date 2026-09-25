import { requireModulePage } from '@/lib/creators/module-page-access';
import { ObsBetOverlay } from "@/components/obs-bet-overlay";
import { resolveObsOverlayInitialStyle } from "@/lib/obs-overlay-settings";

export default async function ObsBetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModulePage(["bets","obs_overlays"]);

  return <ObsBetOverlay initialStyle={await resolveObsOverlayInitialStyle(searchParams)} />;
}
