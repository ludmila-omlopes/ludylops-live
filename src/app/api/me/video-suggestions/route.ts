import { ZodError } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireLinkedApiSession } from "@/lib/api";
import { createVideoSuggestion } from "@/lib/db/repository";
import {
  createVideoSuggestionSchema,
  formatVideoSuggestionSchemaError,
  resolveYoutubeVideoMetadata,
  validateVideoSuggestionDraft,
} from "@/lib/video-suggestions/service";

export async function POST(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireLinkedApiSession();
  if (!session?.user?.activeViewerId) {
    return fail("Unauthorized", 401);
  }

  try {
    const json = await request.json();
    const parsed = createVideoSuggestionSchema.safeParse(json);
    if (!parsed.success) {
      return fail(formatVideoSuggestionSchemaError(parsed.error), 400);
    }

    const validationError = validateVideoSuggestionDraft(parsed.data);
    if (validationError) {
      return fail(validationError, 400);
    }

    const metadata = await resolveYoutubeVideoMetadata(parsed.data.videoUrl);
    const suggestion = await createVideoSuggestion({
      viewerId: session.user.activeViewerId,
      youtubeVideoId: metadata.videoId,
      title: metadata.title,
      creatorName: metadata.creatorName,
      thumbnailUrl: metadata.thumbnailUrl,
      videoUrl: metadata.videoUrl,
      reason: parsed.data.reason,
      source: "web",
    });

    return ok(suggestion, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(formatVideoSuggestionSchemaError(error), 400);
    }

    if (error instanceof SyntaxError) {
      return fail("Payload invalido.", 400);
    }

    const message = error instanceof Error ? error.message : "Falha ao criar sugestao.";
    return fail(message, 400);
  }
}
