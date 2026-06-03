import { NextResponse } from "next/server";

import { getWheelConfig } from "@/lib/wheel";

export const dynamic = "force-dynamic";

export async function GET() {
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
