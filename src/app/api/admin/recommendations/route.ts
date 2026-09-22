import { guardModuleRequest } from '@/lib/creators/module-access';
import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import {
  createProductRecommendationFromInput,
  listAdminProductRecommendations,
} from "@/lib/db/repository";
import {
  formatProductRecommendationSchemaError,
  productRecommendationSchema,
} from "@/lib/recommendation-schemas";
import { slugify } from "@/lib/utils";
import { ZodError } from "zod";

export async function GET(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["product_recommendations"]);
  if (moduleDenial) return moduleDenial;

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  return ok(await listAdminProductRecommendations());
}

export async function POST(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["product_recommendations"]);
  if (moduleDenial) return moduleDenial;

  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const payload = productRecommendationSchema.parse(await request.json());
    const recommendation = await createProductRecommendationFromInput({
      ...payload,
      slug: payload.slug ?? slugify(payload.name),
    });

    return ok(recommendation, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(formatProductRecommendationSchemaError(error), 400);
    }

    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    const message = error instanceof Error ? error.message : "Falha ao criar recomendação.";
    return fail(message, 400);
  }
}
