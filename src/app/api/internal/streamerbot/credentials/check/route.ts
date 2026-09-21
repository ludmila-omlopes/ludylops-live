import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { authenticateStreamerbotRequest } from "@/lib/streamerbot/authenticate";

export async function POST(request: Request) {
  const result = await authenticateStreamerbotRequest(request);
  if (!result.ok) return result.response;
  return Response.json({ ok: true, data: { creatorId: result.creatorId, credentialId: result.credentialId, mode: result.mode, operationalAccess: result.creatorId === DEFAULT_CREATOR_ID } }, { headers: { "Cache-Control": "no-store" } });
}
