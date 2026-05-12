import { ZodError } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { updateVideoSuggestionStatus } from "@/lib/db/repository";
import {
  formatVideoSuggestionSchemaError,
  updateVideoSuggestionStatusSchema,
} from "@/lib/video-suggestions/service";

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
    const parsed = updateVideoSuggestionStatusSchema.safeParse(json);
    if (!parsed.success) {
      return fail(formatVideoSuggestionSchemaError(parsed.error), 400);
    }

    const suggestion = await updateVideoSuggestionStatus({
      suggestionId: id,
      status: parsed.data.status,
    });

    return ok(suggestion);
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(formatVideoSuggestionSchemaError(error), 400);
    }

    if (error instanceof SyntaxError) {
      return fail("Payload invalido.", 400);
    }

    const message = error instanceof Error ? error.message : "Falha ao atualizar sugestao.";
    return fail(message, 400);
  }
}
