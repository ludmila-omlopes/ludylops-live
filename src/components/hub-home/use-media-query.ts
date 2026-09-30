"use client";

import { useSyncExternalStore } from "react";

// Server render assumes the query does not match, so pinned scroll effects start after hydration.
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
