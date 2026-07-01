import { z } from "zod";

import {
  fail,
  isTrustedAppMutationRequest,
  ok,
  requirePlatformOwnerApiSession,
} from "@/lib/api";
import {
  isCreatorModuleStatus,
  updatePlatformCreatorModuleStatus,
} from "@/lib/creators/instances";

const creatorModuleStatusSchema = z.object({
  status: z.string().refine(isCreatorModuleStatus),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; moduleKey: string }> },
) {
  const session = await requirePlatformOwnerApiSession();
  if (!session) {
    return fail("Não autorizado.", 401);
  }
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Origem inválida.", 403);
  }

  const { id, moduleKey } = await params;
  const payload = creatorModuleStatusSchema.parse(await request.json());
  const updatedModule = await updatePlatformCreatorModuleStatus({
    creatorId: id,
    moduleKey,
    status: payload.status,
  });

  if (!updatedModule) {
    return fail("Módulo não encontrado.", 404);
  }

  return ok(updatedModule);
}
