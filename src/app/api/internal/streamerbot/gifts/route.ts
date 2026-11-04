import { authenticateStreamerbotRequest, authorizeStreamerbotOperation } from "@/lib/streamerbot/authenticate";
import { receiveJewelGift } from "@/lib/streamerbot/gifts";
import { jewelGiftSchema } from "@/lib/youtube-gifts";

export async function POST(request: Request) {
  const auth = await authenticateStreamerbotRequest(request);
  if (!auth.ok) return auth.response;
  const denied = await authorizeStreamerbotOperation(auth, "gifts");
  if (denied) return denied;
  let body: unknown;
  try { body = JSON.parse(auth.raw); } catch { return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 }); }
  const parsed = jewelGiftSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  try {
    return Response.json({ ok: true, data: await receiveJewelGift(auth, parsed.data) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "gift_storage_unavailable" }, { status: 503 });
  }
}
