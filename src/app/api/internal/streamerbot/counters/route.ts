import { NextResponse } from "next/server";

import { ok } from "@/lib/api";
import { runStreamerbotCounterCommand } from "@/lib/db/repository";
import { streamerbotCounterCommandSchema } from "@/lib/streamerbot/schemas";
import { authenticateStreamerbotRequest, authorizeStreamerbotOperation } from "@/lib/streamerbot/authenticate";

function mapStreamerbotCounterReply(message: string, requestedBy?: string) {
  const prefix = requestedBy ? `${requestedBy}, ` : "";

  switch (message) {
    case "reset_confirmation_required":
      return `${prefix}reset bloqueado. Reenvie o comando com confirmReset=true para zerar esse contador.`;
    default:
      return `${prefix}não consegui processar esse contador agora.`;
  }
}

export async function POST(request: Request) {
  const authentication = await authenticateStreamerbotRequest(request);
  if (!authentication.ok) return authentication.response;
  const denied = authorizeStreamerbotOperation(authentication, "counters");
  if (denied) return denied;
  const raw = authentication.raw;

  try {
    const payload = streamerbotCounterCommandSchema.parse(JSON.parse(raw));
    const result = await runStreamerbotCounterCommand(payload);

    console.info("[streamerbot/counters] Processed command.", {
      action: payload.action,
      counterKey: payload.counterKey,
      scopeType: payload.scopeType,
      scopeKey: payload.scopeKey ?? "global",
      amount: payload.amount,
      requestedBy: payload.requestedBy,
      count: result.count,
      mode: result.mode,
    });

    return ok({
      action: result.action,
      count: result.count,
      counterKey: result.counter.key,
      scopeType: result.counter.scopeType,
      scopeKey: result.counter.scopeKey,
      lastResetAt: result.counter.lastResetAt,
      updatedAt: result.counter.updatedAt,
      replyMessage: result.replyMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar contador.";
    const requestedBy =
      (() => {
        try {
          const payload = JSON.parse(raw) as { requestedBy?: string };
          return payload.requestedBy;
        } catch {
          return undefined;
        }
      })() ?? undefined;

    console.error("[streamerbot/counters] Failed to process payload.", error);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        replyMessage: mapStreamerbotCounterReply(message, requestedBy),
      },
      { status: 400 },
    );
  }
}
