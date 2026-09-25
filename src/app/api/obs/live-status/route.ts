import { NextResponse } from "next/server";

import { getStreamerbotLivestreamStatus } from "@/lib/streamerbot/live-status";
import { resolvePublicCreatorFromRequest } from "@/lib/creators/tenant";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { canUseModules, moduleUnavailable } from "@/lib/creators/module-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const slugs = new URL(request.url).searchParams.getAll("creator");
  if (slugs.length > 1) return NextResponse.json({ ok: false, error: "creator_unavailable" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const tenant = await resolvePublicCreatorFromRequest({ request, pathname: "/", ...(slugs.length ? { slug: slugs[0] } : {}) });
  if (!tenant || tenant.creator.id !== DEFAULT_CREATOR_ID) return NextResponse.json({ ok: false, error: "creator_unavailable" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!canUseModules(tenant, ["obs_overlays"])) return moduleUnavailable();
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
