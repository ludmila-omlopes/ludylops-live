import { guardModuleRequest } from '@/lib/creators/module-access';
import { NextResponse } from "next/server";

import { getLiveLikeGoalOverlayState } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["points","obs_overlays"]);
  if (moduleDenial) return moduleDenial;

  const state = await getLiveLikeGoalOverlayState();

  return NextResponse.json(
    {
      ok: true,
      data: state,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    },
  );
}
