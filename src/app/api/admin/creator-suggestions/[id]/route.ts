import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import {
  deleteCreatorSuggestion,
  updateAdminCreatorSuggestion,
} from "@/lib/db/repository";
import { createAdminCreatorSuggestionSchema } from "@/lib/creator-suggestions/service";
import { resolveYoutubeChannelMetadata } from "@/lib/youtube/channel-metadata";

function mapCreatorSuggestionError(message: string) {
  switch (message) {
    case "suggestion_not_found":
      return "Indicação não encontrada.";
    case "invalid_youtube_channel_url":
      return "Cole um link de canal do YouTube, como youtube.com/@nome ou youtube.com/channel/ID.";
    case "youtube_api_not_configured":
      return "A busca automática precisa de YOUTUBE_API_KEY configurada.";
    case "youtube_channel_not_found":
      return "Não encontrei esse canal no YouTube.";
    case "suggestion_already_exists":
      return "Esse criador já está cadastrado.";
    default:
      return message;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  const { id } = await params;

  try {
    const parsed = createAdminCreatorSuggestionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Payload inválido.", 400);
    }

    const metadata = await resolveYoutubeChannelMetadata(parsed.data.channelUrl);
    const updated = await updateAdminCreatorSuggestion({
      suggestionId: id,
      name: metadata.name,
      channelUrl: metadata.channelUrl,
      reason: metadata.description,
    });

    return ok(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar criador.";
    return fail(mapCreatorSuggestionError(message), message === "suggestion_not_found" ? 404 : 400);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  const { id } = await params;

  try {
    const deleted = await deleteCreatorSuggestion(id);
    return ok(deleted);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao excluir indicação.";
    return fail(mapCreatorSuggestionError(message), message === "suggestion_not_found" ? 404 : 400);
  }
}
