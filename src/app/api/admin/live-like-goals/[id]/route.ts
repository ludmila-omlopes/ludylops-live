import { z } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { deleteLiveLikeGoal, updateLiveLikeGoal } from "@/lib/db/repository";
import { liveLikeGoalSchema } from "@/lib/streamerbot/schemas";

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
    const payload = liveLikeGoalSchema.parse(await request.json());
    return ok(await updateLiveLikeGoal(id, payload));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail("Dados inválidos para a meta de likes.", 400);
    }
    return fail(error instanceof Error ? error.message : "Falha ao atualizar meta de likes.", 400);
  }
}

export async function DELETE(
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
    return ok(await deleteLiveLikeGoal(id));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Falha ao remover meta de likes.", 400);
  }
}
