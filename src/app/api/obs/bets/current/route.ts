import { NextResponse } from "next/server";

import { listBets } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = Date.now();
  const bets = await listBets();
  const activeBet =
    bets
      .filter(
        (bet) =>
          bet.status === "open" &&
          new Date(bet.closesAt).getTime() > now,
      )
      .sort((left, right) => new Date(right.openedAt ?? right.createdAt).getTime() - new Date(left.openedAt ?? left.createdAt).getTime())[0] ??
    null;

  return NextResponse.json(
    {
      ok: true,
      data: activeBet,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    },
  );
}
