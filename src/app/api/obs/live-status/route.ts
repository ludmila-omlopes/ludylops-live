import { NextResponse } from "next/server";

import { getStreamerbotLivestreamStatus } from "@/lib/streamerbot/live-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getStreamerbotLivestreamStatus();

  return NextResponse.json(
    {
      ok: true,
      data: status,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    },
  );
}
