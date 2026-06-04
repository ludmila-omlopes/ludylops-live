import { NextResponse } from "next/server";

import { listRecentSubscriberAlerts } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
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
