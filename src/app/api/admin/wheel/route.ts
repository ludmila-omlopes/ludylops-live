import { z } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { wheelConfigSchema } from "@/lib/streamerbot/schemas";
import { getWheelConfig, updateWheelConfig } from "@/lib/wheel";

export async function GET() {
  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  return ok(await getWheelConfig());
}

export async function PUT(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const payload = wheelConfigSchema.parse(await request.json());
    const updatedBy = session.user?.email?.toLowerCase() ?? null;
    return ok(await updateWheelConfig({ ...payload, updatedBy }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail("Dados inválidos para a roleta.", 400);
    }
    return fail(error instanceof Error ? error.message : "Falha ao salvar roleta.", 400);
  }
}
