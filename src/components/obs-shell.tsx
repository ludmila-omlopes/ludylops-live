"use client";

import { useEffect } from "react";

export function ObsShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.dataset.obsOverlay = "true";

    return () => {
      delete document.body.dataset.obsOverlay;
    };
  }, []);

  return children;
}
