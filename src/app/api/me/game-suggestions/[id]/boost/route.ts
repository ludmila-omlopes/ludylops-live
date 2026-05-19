import { ZodError } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireLinkedApiSession } from "@/lib/api";
import { boostGameSuggestion } from "@/lib/db/repository";
import {
  boostGameSuggestionSchema,
  formatGameSuggestionSchemaError,
  validateGameSuggestionBoostAmount,
} from "@/lib/game-suggestions/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireLinkedApiSession();
  if (!session?.user?.activeViewerId) {
    return fail("Unauthorized", 401);
  }

  const { id } = await params;

  try {
    const json = await request.json();
    const parsed = boostGameSuggestionSchema.safeParse(json);
    if (!parsed.success) {
      return fail(formatGameSuggestionSchemaError(parsed.error), 400);
    }

    const validationError = validateGameSuggestionBoostAmount(parsed.data.amount);
    if (validationError) {
      return fail(validationError, 400);
    }

    const suggestion = await boostGameSuggestion({
      suggestionId: id,
      viewerId: session.user.activeViewerId,
      amount: parsed.data.amount,
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

    const message = error instanceof Error ? error.message : "Falha ao dar boost.";
    return fail(message, 400);
  }
}
