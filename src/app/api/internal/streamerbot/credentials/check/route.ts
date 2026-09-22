import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { authenticateStreamerbotRequest } from "@/lib/streamerbot/authenticate";
import { streamerbotQuoteModuleIsEnabled } from "@/lib/streamerbot/credentials";

export async function POST(request: Request) {
  const result = await authenticateStreamerbotRequest(request);
  if (!result.ok) return result.response;
  try {
    const operationalAccess = result.creatorId === DEFAULT_CREATOR_ID;
    const quoteActions = await streamerbotQuoteModuleIsEnabled(result.creatorId)
      ? operationalAccess ? ["create", "get", "show"] : ["create", "get"]
      : [];
    return Response.json({ ok: true, data: { creatorId: result.creatorId, credentialId: result.credentialId, mode: result.mode, operationalAccess, quoteActions } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "authorization_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
