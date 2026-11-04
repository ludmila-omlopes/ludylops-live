import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ObsGiftOverlay } from "@/components/obs-gift-overlay";
import { resolveGiftTenant } from "@/lib/creators/sticker-access";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { resolveObsOverlayInitialStyle } from "@/lib/obs-overlay-settings";

export default async function ObsGiftsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (Array.isArray(params.creator)) notFound();
  if (params.creator !== undefined) query.set("creator", params.creator);
  const tenant = await resolveGiftTenant(new Request(`http://internal/?${query}`, { headers: await headers() }));
  if (!tenant) notFound();
  const initialStyle = tenant.creator.id === DEFAULT_CREATOR_ID ? await resolveObsOverlayInitialStyle(searchParams) : "classic";
  return <Suspense fallback={null}><ObsGiftOverlay creatorSlug={tenant.creator.slug} initialStyle={initialStyle} /></Suspense>;
}
