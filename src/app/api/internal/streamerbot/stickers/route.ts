import { authenticateStreamerbotRequest, authorizeStreamerbotOperation } from "@/lib/streamerbot/authenticate";
import { receiveSuperSticker } from "@/lib/streamerbot/stickers";
import { superStickerSchema } from "@/lib/youtube-stickers";

export async function POST(request: Request) {
  const auth = await authenticateStreamerbotRequest(request);
  if (!auth.ok) return auth.response;
  const denied = await authorizeStreamerbotOperation(auth, "stickers");
  if (denied) return denied;
  let body: unknown;
  try { body = JSON.parse(auth.raw); } catch { return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 }); }
  const parsed = superStickerSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  try {
    return Response.json({ ok: true, data: await receiveSuperSticker(auth, parsed.data) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "sticker_storage_unavailable" }, { status: 503 });
  }
}
