import { NextResponse } from "next/server";

import { getLiveLikeGoalOverlayState } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
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
