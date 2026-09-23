import { ZodError } from "zod";
import { authenticateStreamerbotRequest, authorizeStreamerbotOperation } from "@/lib/streamerbot/authenticate";
import { assertCreatorEconomyAccess, rewardCreatorChat } from "@/lib/creators/economy";
import { chatRewardChannelSchema } from "@/lib/creators/chat-rewards";
import { ensureViewerFromStreamerbotIdentity } from "@/lib/db/repository";
import { economyFailure, economyReply } from "@/lib/creators/economy-api";

export async function POST(request: Request) {
  const authentication = await authenticateStreamerbotRequest(request);
  if (!authentication.ok) return authentication.response;
  const denied = await authorizeStreamerbotOperation(authentication, "economy");
  if (denied) return denied;
  try {
    await assertCreatorEconomyAccess(authentication, { kind: "integration" });
    const { viewerExternalId, youtubeDisplayName, ...event } = chatRewardChannelSchema.parse(JSON.parse(authentication.raw));
    const viewer = await ensureViewerFromStreamerbotIdentity({ viewerExternalId, youtubeDisplayName, initializeBalance: false });
    return economyReply({ ok: true, data: await rewardCreatorChat(authentication, { ...event, viewerId: viewer.id }) });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError)
      return economyReply({ ok: false, error: "Informe os IDs válidos do canal, da transmissão e da mensagem." }, 400);
    return economyFailure(error);
  }
}
