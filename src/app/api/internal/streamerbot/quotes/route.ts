import { NextResponse } from "next/server";

import { getPipetzPricing, runQuoteCommandFromChat } from "@/lib/db/repository";
import { streamerbotQuoteCommandSchema } from "@/lib/streamerbot/schemas";
import { authenticateStreamerbotRequest, authorizeStreamerbotOperation } from "@/lib/streamerbot/authenticate";
import { streamerbotQuoteModuleIsEnabled } from "@/lib/streamerbot/credentials";

function formatQuoteReply(input: { quoteNumber: number; body: string }) {
  return `Quote #${input.quoteNumber}: "${input.body}"`;
}

async function mapChatQuoteReply(input: {
  message: string;
  action?: "create" | "get" | "show";
  quoteId?: number;
  viewerName?: string;
}) {
  const prefix = input.viewerName ? `${input.viewerName}, ` : "";

  switch (input.message) {
    case "quote_not_found":
      return input.quoteId
        ? `Quote #${input.quoteId} não encontrada.`
        : "Quote não encontrada.";
    case "quote_list_empty":
      return "Nenhuma quote cadastrada ainda.";
    case "quote_text_required":
      return "Envie o texto da quote junto do comando.";
    case "quote_id_required":
      return "Use !quoteobs <número> para escolher uma quote já existente.";
    case "viewer_external_id_required":
      return "Não consegui identificar quem executou o comando.";
    case "livestream_not_live":
      return "Essa quote só pode ir para o OBS enquanto a live estiver acontecendo.";
    case "saldo_insuficiente":
      return `${prefix}você precisa de ${(await getPipetzPricing()).quoteOverlayCost} pipetz para colocar a quote no OBS.`;
    case "quote_overlay_busy":
      return "Já tem uma quote ocupando o overlay. Tenta de novo em alguns segundos.";
    default:
      if (input.action === "create") {
        return "Não consegui salvar a quote agora.";
      }

      if (input.action === "show") {
        return "Não consegui colocar a quote na tela agora.";
      }

      return "Não consegui buscar a quote agora.";
  }
}

function readPayloadContext(raw: string) {
  try {
    const payload = JSON.parse(raw) as {
      action?: "create" | "get" | "show";
      quoteId?: number;
      youtubeDisplayName?: string;
    };

    return {
      action: payload.action,
      quoteId: payload.quoteId,
      viewerName: payload.youtubeDisplayName,
    };
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const authentication = await authenticateStreamerbotRequest(request);
  if (!authentication.ok) return authentication.response;
  const raw = authentication.raw;

  try {
    const payload = streamerbotQuoteCommandSchema.parse(JSON.parse(raw));
    const operation = payload.action === "show" ? "quotes.legacy" : payload.action === "create" ? "quotes.create" : "quotes.get";
    const denied = await authorizeStreamerbotOperation(authentication, operation);
    if (denied) return denied;
    if (!await streamerbotQuoteModuleIsEnabled(authentication.creatorId)) {
      return NextResponse.json({ ok: false, error: "creator_unavailable", replyMessage: "As frases estão indisponíveis para este streamer." }, { status: 403 });
    }
    const result = await runQuoteCommandFromChat({ creatorId: authentication.creatorId }, payload);
    const replyMessage =
      result.action === "create"
        ? `Quote #${result.quote.quoteNumber} salva: "${result.quote.body}"`
        : result.action === "show"
          ? result.queued
            ? `${payload.youtubeDisplayName ?? result.viewer?.youtubeDisplayName ?? "Viewer"}, a quote #${
                result.quote.quoteNumber
              } entrou na fila do OBS. Ela aparece quando a admin retomar as chamadas.`
            : `${payload.youtubeDisplayName ?? result.viewer?.youtubeDisplayName ?? "Viewer"} colocou a quote #${
                result.quote.quoteNumber
              } no OBS por ${Math.round(
                (new Date(result.overlay!.expiresAt).getTime() - new Date(result.overlay!.activatedAt).getTime()) /
                  1000,
              )}s (-${result.overlay!.cost} pipetz).`
          : formatQuoteReply(result.quote);

    console.info("[streamerbot/quotes] Processed quote command.", {
      action: payload.action,
      quoteNumber: result.quote.quoteNumber,
      viewerExternalId: payload.viewerExternalId ?? null,
      source: payload.source,
    });

    return NextResponse.json({
      ok: true,
      replyMessage,
      data: {
        action: result.action,
        quoteId: result.quote.quoteNumber,
        quote: result.quote,
        overlay: result.action === "show" ? result.overlay : null,
        queued: result.action === "show" ? result.queued : null,
        replyMessage,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar quote.";
    const context = readPayloadContext(raw);

    console.error("[streamerbot/quotes] Failed to process payload.", error);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        replyMessage: await mapChatQuoteReply({
          message,
          action: context.action,
          quoteId: context.quoteId,
          viewerName: context.viewerName,
        }),
      },
      { status: 400 },
    );
  }
}
