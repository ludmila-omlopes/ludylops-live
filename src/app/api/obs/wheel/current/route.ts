import { guardModuleRequest } from '@/lib/creators/module-access';
import { NextResponse } from "next/server";

import { getWheelConfig } from "@/lib/wheel";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["obs_overlays"]);
  if (moduleDenial) return moduleDenial;

  const config = await getWheelConfig();

  return NextResponse.json(
    {
      ok: true,
      data: config,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    },
  );
}
