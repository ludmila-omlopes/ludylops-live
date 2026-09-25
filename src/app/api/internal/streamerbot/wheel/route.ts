import { NextResponse } from "next/server";

import { ok } from "@/lib/api";
import { wheelSpinRequestSchema } from "@/lib/streamerbot/schemas";
import { authenticateStreamerbotRequest, authorizeStreamerbotOperation } from "@/lib/streamerbot/authenticate";
import { triggerWheelSpin } from "@/lib/wheel";

export async function POST(request: Request) {
  const authentication = await authenticateStreamerbotRequest(request);
  if (!authentication.ok) return authentication.response;
  const denied = await authorizeStreamerbotOperation(authentication, "wheel");
  if (denied) return denied;
  const raw = authentication.raw;

  try {
    const payload = wheelSpinRequestSchema.parse(JSON.parse(raw || "{}"));
    const config = await triggerWheelSpin({ ...payload, source: payload.source ?? "streamerbot_chat" });
    const result = config.lastSpin;

    console.info("[streamerbot/wheel] Triggered wheel spin.", {
      requestedBy: payload.requestedBy,
      result: result?.label,
      spinId: result?.spinId,
    });

    return ok({
      config,
      result,
      replyMessage: result ? `Roleta girando: ${result.label}.` : "Roleta girando.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao girar roleta.";
    console.error("[streamerbot/wheel] Failed to process payload.", error);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        replyMessage: "Não consegui girar a roleta agora.",
      },
      { status: 400 },
    );
  }
}
