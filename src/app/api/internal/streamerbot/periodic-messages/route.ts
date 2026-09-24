import { authenticateStreamerbotRequest, authorizeStreamerbotOperation } from "@/lib/streamerbot/authenticate";
import { dispatchPeriodicMessages } from "@/lib/creators/periodic-messages.server";
import { periodicReply, periodicFailure } from "@/lib/creators/periodic-messages-api";
export async function POST(request: Request) {
  const authentication = await authenticateStreamerbotRequest(request);
  if (!authentication.ok) return authentication.response;
  const denied = await authorizeStreamerbotOperation(authentication, "periodic-messages");
  if (denied) return denied;
  try { return periodicReply({ ok: true, data: await dispatchPeriodicMessages(authentication, JSON.parse(authentication.raw)) }); }
  catch (error) { return periodicFailure(error); }
}
