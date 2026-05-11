import { ZodError } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { updateGameSuggestionCatalog, updateGameSuggestionStatus } from "@/lib/db/repository";
import {
  formatGameSuggestionSchemaError,
  updateGameSuggestionCatalogSchema,
  updateGameSuggestionStatusSchema,
} from "@/lib/game-suggestions/service";

export async function POST(
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
    const json = await request.json();
    const parsed = updateGameSuggestionStatusSchema.safeParse(json);
    if (!parsed.success) {
      return fail(formatGameSuggestionSchemaError(parsed.error), 400);
    }

    const suggestion = await updateGameSuggestionStatus({
      suggestionId: id,
      status: parsed.data.status,
    });

    return ok(suggestion);
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(formatGameSuggestionSchemaError(error), 400);
    }

    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    const message = error instanceof Error ? error.message : "Falha ao atualizar sugestão.";
    return fail(message, 400);
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
    const json = await request.json();
    const parsed = updateGameSuggestionCatalogSchema.safeParse(json);
    if (!parsed.success) {
      return fail(formatGameSuggestionSchemaError(parsed.error), 400);
    }

    const suggestion = await updateGameSuggestionCatalog({
      suggestionId: id,
      ...parsed.data,
    });

    return ok(suggestion);
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(formatGameSuggestionSchemaError(error), 400);
    }

    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    const message = error instanceof Error ? error.message : "Falha ao atualizar jogo.";
    return fail(message, 400);
  }
}
