import { ObsQuoteOverlay } from "@/components/obs-quote-overlay";
import { resolveObsOverlayInitialStyle } from "@/lib/obs-overlay-settings";
import { resolveQuotePage } from "@/lib/creators/quote-page-context";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { notFound } from "next/navigation";

export default async function ObsQuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await resolveQuotePage(await searchParams);
  if (!tenant || tenant.creator.id !== DEFAULT_CREATOR_ID) notFound();
  return <ObsQuoteOverlay creatorSlug={tenant.creator.slug} initialStyle={await resolveObsOverlayInitialStyle(searchParams)} />;
}
