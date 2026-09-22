import { NextResponse } from "next/server";

import { ok } from "@/lib/api";
import { runDeathCounterCommand } from "@/lib/db/repository";
import { streamerbotDeathCounterCommandSchema } from "@/lib/streamerbot/schemas";
import { authenticateStreamerbotRequest, authorizeStreamerbotOperation } from "@/lib/streamerbot/authenticate";

function mapDeathCounterReply(message: string, requestedBy?: string) {
  const prefix = requestedBy ? `${requestedBy}, ` : "";

  switch (message) {
    case "reset_confirmation_required":
      return `${prefix}reset bloqueado. Reenvie o comando com confirmReset=true para zerar o contador.`;
    default:
      return `${prefix}não consegui processar o contador de mortes agora.`;
  }
}

export async function POST(request: Request) {
  const authentication = await authenticateStreamerbotRequest(request);
  if (!authentication.ok) return authentication.response;
  const denied = await authorizeStreamerbotOperation(authentication, "deaths");
  if (denied) return denied;
  const raw = authentication.raw;

  try {
    const payload = streamerbotDeathCounterCommandSchema.parse(JSON.parse(raw));
    const result = await runDeathCounterCommand(payload);

    console.info("[streamerbot/deaths] Processed command.", {
      action: payload.action,
      scopeType: result.counter.scopeType,
      scopeKey: result.counter.scopeKey ?? "global",
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
    const message = error instanceof Error ? error.message : "Falha ao processar contador de mortes.";
    const requestedBy =
      (() => {
        try {
          const payload = JSON.parse(raw) as { requestedBy?: string };
          return payload.requestedBy;
        } catch {
          return undefined;
        }
      })() ?? undefined;

    console.error("[streamerbot/deaths] Failed to process payload.", error);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        replyMessage: mapDeathCounterReply(message, requestedBy),
      },
      { status: 400 },
    );
  }
}
