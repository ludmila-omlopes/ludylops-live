import { ZodError } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireLinkedApiSession } from "@/lib/api";
import { createCreatorSuggestion } from "@/lib/db/repository";
import {
  createCreatorSuggestionSchema,
  formatCreatorSuggestionSchemaError,
  validateCreatorSuggestionDraft,
} from "@/lib/creator-suggestions/service";

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
    const parsed = createCreatorSuggestionSchema.safeParse(json);
    if (!parsed.success) {
      return fail(formatCreatorSuggestionSchemaError(parsed.error), 400);
    }

    const validationError = validateCreatorSuggestionDraft(parsed.data);
    if (validationError) {
      return fail(validationError, 400);
    }

    const suggestion = await createCreatorSuggestion({
      viewerId: session.user.activeViewerId,
      name: parsed.data.name,
      channelUrl: parsed.data.channelUrl,
      platform: parsed.data.platform,
      category: parsed.data.category,
      reason: parsed.data.reason,
      source: "web",
    });

    return ok(suggestion, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(formatCreatorSuggestionSchemaError(error), 400);
    }

    if (error instanceof SyntaxError) {
      return fail("Payload invalido.", 400);
    }

    const message = error instanceof Error ? error.message : "Falha ao criar indicacao.";
    return fail(message, 400);
  }
}
