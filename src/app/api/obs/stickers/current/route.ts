import { resolveStickerTenant } from "@/lib/creators/sticker-access";
import { moduleUnavailable } from "@/lib/creators/module-access";
import { listSuperStickers } from "@/lib/streamerbot/stickers";
import { stickerCursorSchema } from "@/lib/youtube-stickers";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const tenant = await resolveStickerTenant(request);
    if (!tenant) return moduleUnavailable();
    const cursors = new URL(request.url).searchParams.getAll("cursor");
    if (cursors.length > 1 || (cursors.length && !stickerCursorSchema.safeParse(cursors[0]).success))
      return Response.json({ ok: false, error: "invalid_cursor" }, { status: 400 });
    const data = await listSuperStickers({ creatorId: tenant.creator.id }, cursors[0]);
    return Response.json({ ok: true, data }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch { return moduleUnavailable(503); }
}
