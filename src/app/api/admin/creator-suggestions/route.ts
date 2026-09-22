import { guardModuleRequest } from '@/lib/creators/module-access';
import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { createAdminCreatorSuggestion } from "@/lib/db/repository";
import { createAdminCreatorSuggestionSchema } from "@/lib/creator-suggestions/service";
import { resolveYoutubeChannelMetadata } from "@/lib/youtube/channel-metadata";

function mapCreatorSuggestionError(message: string) {
  switch (message) {
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

export async function POST(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["creator_suggestions"]);
  if (moduleDenial) return moduleDenial;

  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session?.user?.activeViewerId) {
    return fail("Forbidden", 403);
  }

  try {
    const parsed = createAdminCreatorSuggestionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Payload inválido.", 400);
    }

    const metadata = await resolveYoutubeChannelMetadata(parsed.data.channelUrl);
    const created = await createAdminCreatorSuggestion({
      viewerId: session.user.activeViewerId,
      name: metadata.name,
      channelUrl: metadata.channelUrl,
      reason: metadata.description,
    });

    return ok(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao incluir criador.";
    return fail(mapCreatorSuggestionError(message), 400);
  }
}
