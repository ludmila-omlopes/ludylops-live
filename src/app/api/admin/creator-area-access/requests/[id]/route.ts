import { z, ZodError } from "zod";
import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { CreatorBetaConflictError, reviewCreatorBetaRequest } from "@/lib/creators/access";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isTrustedAppMutationRequest(request)) return fail("Forbidden", 403);
  const session = await requireAdminApiSession();
  if (!session) return fail("Forbidden", 403);
  try {
    const { decision } = z.object({ decision: z.enum(["approved", "rejected"]) }).strict().parse(await request.json());
    const { id } = await context.params;
    return ok(await reviewCreatorBetaRequest(id, decision, session.user!.email!));
  } catch (error) {
    if (error instanceof SyntaxError) return fail("Decisão inválida.", 400);
    if (error instanceof ZodError) return fail(error.issues[0]?.message ?? "Decisão inválida.", 400);
    if (error instanceof CreatorBetaConflictError) return fail(error.message, 409);
    return fail("Não foi possível analisar o pedido. Tente novamente.", 503);
  }
}
