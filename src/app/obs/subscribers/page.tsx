import { Suspense } from "react";

import { ObsSubscriberOverlay } from "@/components/obs-subscriber-overlay";
import { resolveObsOverlayInitialStyle } from "@/lib/obs-overlay-settings";

export default async function ObsSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initialStyle = await resolveObsOverlayInitialStyle(searchParams);

  return (
    <Suspense fallback={null}>
      <ObsSubscriberOverlay initialStyle={initialStyle} />
    </Suspense>
  );
}
