import { authenticateStreamerbotRequest, authorizeStreamerbotOperation } from "@/lib/streamerbot/authenticate";
import { dispatchCreatorRedemptions } from "@/lib/creators/redemptions.server";
import { redemptionReply, redemptionFailure } from "@/lib/creators/redemptions-api";
export async function POST(request: Request) {
  const authentication = await authenticateStreamerbotRequest(request);
  if (!authentication.ok) return authentication.response;
  const denied = await authorizeStreamerbotOperation(authentication, "redemptions");
  if (denied) return denied;
  try { return redemptionReply({ ok: true, data: await dispatchCreatorRedemptions(authentication.creatorId, JSON.parse(authentication.raw)) }); }
  catch (error) { return redemptionFailure(error); }
}
