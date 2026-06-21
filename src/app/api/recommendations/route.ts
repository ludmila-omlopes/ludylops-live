import { ZodError } from "zod";

import { fail, isTrustedAppMutationRequest, ok } from "@/lib/api";
import { createProductRecommendationSubmission } from "@/lib/db/repository";
import {
  formatProductRecommendationSchemaError,
  productRecommendationSubmissionSchema,
} from "@/lib/recommendation-schemas";

export async function POST(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  try {
    const payload = productRecommendationSubmissionSchema.parse(await request.json());
    const recommendation = await createProductRecommendationSubmission(payload);

    return ok(recommendation, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(formatProductRecommendationSchemaError(error), 400);
    }

    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    const message = error instanceof Error ? error.message : "Falha ao enviar recomendação.";
    return fail(message, 400);
  }
}
