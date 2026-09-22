import { NextResponse } from "next/server";

import { ok } from "@/lib/api";
import { placeBetFromChatCommand } from "@/lib/db/repository";
import { streamerbotChatBetSchema } from "@/lib/streamerbot/schemas";
import { authenticateStreamerbotRequest, authorizeStreamerbotOperation } from "@/lib/streamerbot/authenticate";
import { formatPipetz } from "@/lib/utils";

function mapChatBetReply(message: string, viewerName?: string) {
  const prefix = viewerName ? `${viewerName}, ` : "";

  switch (message) {
    case "saldo_insuficiente":
      return `${prefix}você não tem pipetz suficientes para essa aposta.`;
    case "aposta_ja_registrada":
      return `${prefix}você já apostou nessa rodada.`;
    case "bet_not_open":
      return "Essa aposta não está aberta no momento.";
    case "bet_closed":
      return "A janela de aposta ja fechou.";
    case "invalid_option":
      return "Opção inválida. Use o número ou nome exibido na aposta.";
    case "multiple_open_bets":
      return "Ha mais de uma aposta aberta. Configure lojaneon.activeBetId ou envie betId no comando do Streamer.bot.";
    case "Aposta não encontrada.":
      return "Nenhuma aposta aberta foi encontrada para esse comando.";
    default:
      return "Não consegui registrar a aposta agora.";
  }
}

export async function POST(request: Request) {
  const authentication = await authenticateStreamerbotRequest(request);
  if (!authentication.ok) return authentication.response;
  const denied = await authorizeStreamerbotOperation(authentication, "bets.place");
  if (denied) return denied;
  const raw = authentication.raw;

  try {
    const payload = streamerbotChatBetSchema.parse(JSON.parse(raw));
    const result = await placeBetFromChatCommand(payload);
    const viewerName = payload.youtubeDisplayName ?? result.viewer.youtubeDisplayName;
    const optionIndex = result.option.sortOrder + 1;
    const wasTopUp = result.entry.amount > payload.amount;

    console.info("[streamerbot/bets/place] Registered chat bet.", {
      betId: result.bet.id,
      optionId: result.option.id,
      viewerId: result.viewer.id,
      viewerExternalId: payload.viewerExternalId,
      amount: payload.amount,
      source: payload.source,
    });

    return ok({
      betId: result.bet.id,
      question: result.bet.question,
      optionId: result.option.id,
      optionIndex,
      optionLabel: result.option.label,
      viewerId: result.viewer.id,
      viewerExternalId: payload.viewerExternalId,
      amount: payload.amount,
      replyMessage: wasTopUp
        ? `${viewerName} adicionou ${formatPipetz(payload.amount)} em #${optionIndex} ${result.option.label}. Total: ${formatPipetz(result.entry.amount)}.`
        : `${viewerName} apostou ${formatPipetz(payload.amount)} em #${optionIndex} ${result.option.label}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao registrar aposta.";
    const payloadSnapshot =
      (() => {
        try {
          const payload = JSON.parse(raw) as {
            youtubeDisplayName?: string;
            viewerExternalId?: string;
            betId?: string;
            optionId?: string;
            optionIndex?: number;
            optionLabel?: string;
            amount?: number;
          };
          return payload;
        } catch {
          return null;
        }
      })();
    const viewerName = payloadSnapshot?.youtubeDisplayName ?? undefined;

    console.error("[streamerbot/bets/place] Failed to process payload.", {
      error,
      viewerExternalId: payloadSnapshot?.viewerExternalId ?? null,
      betId: payloadSnapshot?.betId ?? null,
      optionId: payloadSnapshot?.optionId ?? null,
      optionIndex: payloadSnapshot?.optionIndex ?? null,
      optionLabel: payloadSnapshot?.optionLabel ?? null,
      amount: payloadSnapshot?.amount ?? null,
    });
    return NextResponse.json(
      {
        ok: false,
        error: message,
        replyMessage: mapChatBetReply(message, viewerName),
      },
      { status: 400 },
    );
  }
}
