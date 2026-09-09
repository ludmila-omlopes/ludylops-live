import { Suspense } from "react";

import { ObsShell } from "@/components/obs-shell";

export default function ObsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={null}>
      <ObsShell>{children}</ObsShell>
    </Suspense>
  );
}
