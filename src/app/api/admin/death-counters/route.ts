import { z } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { setDeathCounterValue } from "@/lib/db/repository";

const updateDeathCounterSchema = z.object({
  counterKey: z.enum(["death_count", "death_count_daily"]),
  scopeType: z.enum(["global", "game"]),
  scopeKey: z.string().trim().min(1).max(120),
  scopeLabel: z.string().trim().max(255).nullable().optional(),
  value: z.number().int().min(0).max(1_000_000),
});

export async function POST(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const payload = updateDeathCounterSchema.parse(await request.json());
    const counter = await setDeathCounterValue({
      ...payload,
      updatedBy: session.user?.email?.toLowerCase() ?? null,
    });
    return ok(counter);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }
    if (error instanceof z.ZodError) {
      return fail(error.issues[0]?.message ?? "Payload inválido.", 400);
    }
    return fail(error instanceof Error ? error.message : "Falha ao atualizar o contador.", 400);
  }
}
