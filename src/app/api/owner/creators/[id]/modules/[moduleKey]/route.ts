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
  ModuleTransitionError,
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

  try {
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
  } catch (error) {
    if (error instanceof ModuleTransitionError)
      return Response.json(
        { ok: false, error: error.message, transition: error.details },
        { status: 409 },
      );
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return fail("Dados inválidos.", 400);
    return fail("Não foi possível atualizar o módulo agora.", 503);
  }
}
