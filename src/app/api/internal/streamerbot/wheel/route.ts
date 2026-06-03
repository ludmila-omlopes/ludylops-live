import { NextResponse } from "next/server";

import { ok } from "@/lib/api";
import { env } from "@/lib/env";
import { wheelSpinRequestSchema } from "@/lib/streamerbot/schemas";
import { verifySignedRequest } from "@/lib/streamerbot/security";
import { triggerWheelSpin } from "@/lib/wheel";

export async function POST(request: Request) {
  const raw = await request.text();
  const timestamp = request.headers.get("x-timestamp");
  const signature = request.headers.get("x-signature");

  const valid = verifySignedRequest({
    body: raw,
    timestamp,
    signature,
    secret: env.STREAMERBOT_SHARED_SECRET,
  });
  if (!valid) {
    console.warn("[streamerbot/wheel] Invalid signature.", {
      hasSecret: Boolean(env.STREAMERBOT_SHARED_SECRET),
      hasTimestamp: Boolean(timestamp),
      hasSignature: Boolean(signature),
    });
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid signature.",
        replyMessage: "Assinatura inválida no comando da roleta.",
      },
      { status: 401 },
    );
  }

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
