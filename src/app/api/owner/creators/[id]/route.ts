import { z } from "zod";

import {
  fail,
  isTrustedAppMutationRequest,
  ok,
  requirePlatformOwnerApiSession,
} from "@/lib/api";
import {
  isCreatorStatus,
  updatePlatformCreatorStatus,
} from "@/lib/creators/instances";

const creatorStatusSchema = z.object({
  status: z.string().refine(isCreatorStatus),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requirePlatformOwnerApiSession();
  if (!session) {
    return fail("Não autorizado.", 401);
  }
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Origem inválida.", 403);
  }

  const { id } = await params;
  const payload = creatorStatusSchema.parse(await request.json());
  const creator = await updatePlatformCreatorStatus({
    creatorId: id,
    status: payload.status,
  });

  if (!creator) {
    return fail("Criador não encontrado.", 404);
  }

  return ok(creator);
}
