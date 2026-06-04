import { Suspense } from "react";

import { ObsSubscriberOverlay } from "@/components/obs-subscriber-overlay";

export default function ObsSubscribersPage() {
  return (
    <Suspense fallback={null}>
      <ObsSubscriberOverlay />
    </Suspense>
  );
}
