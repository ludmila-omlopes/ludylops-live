import { fail, ok } from "@/lib/api";
import { ingestStreamerbotEvent } from "@/lib/db/repository";
import { streamerbotEventSchema } from "@/lib/streamerbot/schemas";
import { authenticateStreamerbotRequest, authorizeStreamerbotOperation } from "@/lib/streamerbot/authenticate";

export async function POST(request: Request) {
  const authentication = await authenticateStreamerbotRequest(request);
  if (!authentication.ok) return authentication.response;
  const denied = authorizeStreamerbotOperation(authentication, "events");
  if (denied) return denied;
  const raw = authentication.raw;

  try {
    const payload = streamerbotEventSchema.parse(JSON.parse(raw));
    const result = await ingestStreamerbotEvent(payload);
    console.info("[streamerbot/events] Processed event.", {
      eventId: payload.eventId,
      eventType: payload.eventType,
      result,
    });
    return ok(result);
  } catch (error) {
    console.error("[streamerbot/events] Failed to process payload.", error);
    return fail("Invalid payload.", 400);
  }
}
