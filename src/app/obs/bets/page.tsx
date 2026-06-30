import { ObsBetOverlay } from "@/components/obs-bet-overlay";
import { resolveObsOverlayInitialStyle } from "@/lib/obs-overlay-settings";

export default async function ObsBetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ObsBetOverlay initialStyle={await resolveObsOverlayInitialStyle(searchParams)} />;
}
