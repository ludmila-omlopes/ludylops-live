import { guardModuleRequest } from '@/lib/creators/module-access';
import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { formatCreateBetSchemaError, validateCreateBetDraft } from "@/lib/bets/admin";
import { createBet, listAdminBets } from "@/lib/db/repository";
import { createBetSchema } from "@/lib/streamerbot/schemas";
import { ZodError } from "zod";

export async function GET(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["bets"]);
  if (moduleDenial) return moduleDenial;

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  return ok(await listAdminBets());
}

export async function POST(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["bets"]);
  if (moduleDenial) return moduleDenial;

  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const json = await request.json();
    const parsed = createBetSchema.safeParse(json);
    if (!parsed.success) {
      return fail(formatCreateBetSchemaError(parsed.error), 400);
    }

    const validationError = validateCreateBetDraft(parsed.data);
    if (validationError) {
      return fail(validationError, 400);
    }

    const bet = await createBet(parsed.data);
    return ok(bet, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(formatCreateBetSchemaError(error), 400);
    }

    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    const message = error instanceof Error ? error.message : "Falha ao criar aposta.";
    return fail(message, 400);
  }
}
