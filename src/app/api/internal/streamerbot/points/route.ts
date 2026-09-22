import { NextResponse } from "next/server";

import { ok } from "@/lib/api";
import { getViewerBalanceFromChatCommand } from "@/lib/db/repository";
import { streamerbotViewerBalanceCommandSchema } from "@/lib/streamerbot/schemas";
import { authenticateStreamerbotRequest, authorizeStreamerbotOperation } from "@/lib/streamerbot/authenticate";
import { formatPipetz } from "@/lib/utils";

function mapViewerBalanceReply(message: string, viewerName?: string) {
  const prefix = viewerName ? `${viewerName}, ` : "";

  switch (message) {
    case "viewer_external_id_required":
      return "Não consegui identificar seu canal do YouTube para consultar seus pipetz.";
    case "viewer_not_ready":
      return `${prefix}ainda não encontrei sua conta da live para consultar seus pipetz.`;
    default:
      return `${prefix}não consegui consultar seus pipetz agora.`;
  }
}

export async function POST(request: Request) {
  const authentication = await authenticateStreamerbotRequest(request);
  if (!authentication.ok) return authentication.response;
  const denied = await authorizeStreamerbotOperation(authentication, "points");
  if (denied) return denied;
  const raw = authentication.raw;

  try {
    const payload = streamerbotViewerBalanceCommandSchema.parse(JSON.parse(raw));
    const result = await getViewerBalanceFromChatCommand(payload);
    const viewerName = payload.youtubeDisplayName?.trim() || result.viewer.youtubeDisplayName;
    const replyMessage = `${viewerName}, seu saldo atual é ${formatPipetz(result.balance.currentBalance)} pipetz.`;

    console.info("[streamerbot/points] Processed balance lookup.", {
      viewerId: result.viewer.id,
      viewerExternalId: payload.viewerExternalId,
      source: payload.source,
      balance: result.balance.currentBalance,
    });

    return ok({
      viewerId: result.viewer.id,
      viewerExternalId: result.viewer.youtubeChannelId,
      balance: result.balance.currentBalance,
      lifetimeEarned: result.balance.lifetimeEarned,
      lifetimeSpent: result.balance.lifetimeSpent,
      lastSyncedAt: result.balance.lastSyncedAt,
      replyMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar saldo.";
    const viewerName =
      (() => {
        try {
          const payload = JSON.parse(raw) as { youtubeDisplayName?: string };
          return payload.youtubeDisplayName?.trim() || undefined;
        } catch {
          return undefined;
        }
      })() ?? undefined;

    console.error("[streamerbot/points] Failed to process payload.", error);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        replyMessage: mapViewerBalanceReply(message, viewerName),
      },
      { status: 400 },
    );
  }
}
