import { z } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { getPipetzPricing, updatePipetzPricing } from "@/lib/db/repository";

const pricingSchema = z.object({
  gameSuggestionCost: z.number().int().min(1).max(1_000_000),
  videoSuggestionCost: z.number().int().min(1).max(1_000_000),
  quoteOverlayCost: z.number().int().min(1).max(1_000_000),
});

export async function GET() {
  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  return ok(await getPipetzPricing());
}

export async function PATCH(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const parsed = pricingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail("Precos devem ser numeros inteiros maiores que zero.", 400);
    }

    const data = await updatePipetzPricing({
      ...parsed.data,
      updatedBy: session.user?.email?.toLowerCase() ?? null,
    });

    return ok(data);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail("Payload invalido.", 400);
    }

    return fail(error instanceof Error ? error.message : "Falha ao salvar precos.", 400);
  }
}
