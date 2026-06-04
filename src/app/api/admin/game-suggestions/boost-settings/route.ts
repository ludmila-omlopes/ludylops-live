import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import {
  getGameSuggestionBoostSettings,
  updateGameSuggestionBoostSettings,
} from "@/lib/db/repository";
import {
  formatGameSuggestionSchemaError,
  updateGameSuggestionBoostSettingsSchema,
} from "@/lib/game-suggestions/service";

export async function GET() {
  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  return ok(await getGameSuggestionBoostSettings());
}

export async function PATCH(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const parsed = updateGameSuggestionBoostSettingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(formatGameSuggestionSchemaError(parsed.error), 400);
    }

    const data = await updateGameSuggestionBoostSettings({
      ...parsed.data,
      updatedBy: session.user?.email?.toLowerCase() ?? null,
    });

    return ok(data);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    if (error instanceof Error && error.message === "invalid_multiplier") {
      return fail("Multiplicadores devem ficar entre 0 e 10.", 400);
    }

    return fail(error instanceof Error ? error.message : "Falha ao salvar multiplicadores.", 400);
  }
}
