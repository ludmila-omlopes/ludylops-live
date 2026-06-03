import { z } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { wheelSpinRequestSchema } from "@/lib/streamerbot/schemas";
import { triggerWheelSpin } from "@/lib/wheel";

export async function POST(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const parsed = wheelSpinRequestSchema.parse(await request.json().catch(() => ({})));
    return ok(await triggerWheelSpin(parsed));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail("Dados inválidos para o giro da roleta.", 400);
    }
    return fail(error instanceof Error ? error.message : "Falha ao girar roleta.", 400);
  }
}
