import { ZodError } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireApiSession } from "@/lib/api";
import { createGameSuggestion } from "@/lib/db/repository";
import {
  createGameSuggestionSchema,
  formatGameSuggestionSchemaError,
  validateGameSuggestionDraft,
} from "@/lib/game-suggestions/service";

export async function POST(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireApiSession();
  if (!session?.user?.activeViewerId) {
    return fail("Unauthorized", 401);
  }

  try {
    const json = await request.json();
    const parsed = createGameSuggestionSchema.safeParse(json);
    if (!parsed.success) {
      return fail(formatGameSuggestionSchemaError(parsed.error), 400);
    }

    const validationError = validateGameSuggestionDraft(parsed.data);
    if (validationError) {
      return fail(validationError, 400);
    }

    const suggestion = await createGameSuggestion({
      viewerId: session.user.activeViewerId,
      name: parsed.data.name,
      description: parsed.data.description,
      igdbId: parsed.data.igdbId,
      canonicalName: parsed.data.canonicalName,
      coverImageUrl: parsed.data.coverImageUrl,
      releaseYear: parsed.data.releaseYear,
      platforms: parsed.data.platforms,
      genres: parsed.data.genres,
      source: "web",
    });

    return ok(suggestion, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(formatGameSuggestionSchemaError(error), 400);
    }

    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    const message = error instanceof Error ? error.message : "Falha ao criar sugestão.";
    return fail(message, 400);
  }
}
