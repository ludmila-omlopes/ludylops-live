import { z } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { createLiveLikeGoal, listAdminLiveLikeGoals } from "@/lib/db/repository";
import { liveLikeGoalSchema } from "@/lib/streamerbot/schemas";

export async function GET() {
  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  return ok(await listAdminLiveLikeGoals());
}

export async function POST(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const payload = liveLikeGoalSchema.parse(await request.json());
    return ok(await createLiveLikeGoal(payload), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail("Dados inválidos para a meta de likes.", 400);
    }
    return fail(error instanceof Error ? error.message : "Falha ao salvar meta de likes.", 400);
  }
}
