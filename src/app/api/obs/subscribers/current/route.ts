import { guardModuleRequest } from '@/lib/creators/module-access';
import { NextResponse } from "next/server";

import { listRecentSubscriberAlerts } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["points","obs_overlays"]);
  if (moduleDenial) return moduleDenial;

  const alerts = await listRecentSubscriberAlerts();

  return NextResponse.json(
    {
      ok: true,
      data: alerts,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    },
  );
}
