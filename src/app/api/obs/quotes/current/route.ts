import { NextResponse } from "next/server";

import { processNextQueuedQuoteOverlay } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const overlay = await processNextQueuedQuoteOverlay();

  return NextResponse.json(
    {
      ok: true,
      data: overlay,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    },
  );
}
