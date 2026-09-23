import { authenticateStreamerbotRequest, authorizeStreamerbotOperation } from "@/lib/streamerbot/authenticate";
import { economyFailure, economyReply, mutateChannelEconomy } from "@/lib/creators/economy-api";

export async function POST(request: Request) {
  const authentication = await authenticateStreamerbotRequest(request);
  if (!authentication.ok) return authentication.response;
  const denied = await authorizeStreamerbotOperation(authentication, "economy");
  if (denied) return denied;
  try {
    return economyReply({ ok: true, data: await mutateChannelEconomy(authentication,
      { kind: "integration" }, JSON.parse(authentication.raw)) });
  } catch (error) { return economyFailure(error); }
}
