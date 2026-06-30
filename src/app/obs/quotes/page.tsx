import { ObsQuoteOverlay } from "@/components/obs-quote-overlay";
import { resolveObsOverlayInitialStyle } from "@/lib/obs-overlay-settings";

export default async function ObsQuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ObsQuoteOverlay initialStyle={await resolveObsOverlayInitialStyle(searchParams)} />;
}
