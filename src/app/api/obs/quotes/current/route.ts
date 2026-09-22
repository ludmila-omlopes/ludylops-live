import { NextResponse } from "next/server";

import { processNextQueuedQuoteOverlay } from "@/lib/db/repository";
import { resolveQuoteRequest } from "@/lib/creators/quote-context";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = await resolveQuoteRequest(request);
  if (!tenant || tenant.creator.id !== DEFAULT_CREATOR_ID) {
    return NextResponse.json({ ok: false, error: tenant ? "operation_not_isolated" : "creator_unavailable" }, { status: tenant ? 403 : 404, headers: { "Cache-Control": "no-store" } });
  }
  const overlay = await processNextQueuedQuoteOverlay({ creatorId: tenant.creator.id });

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
