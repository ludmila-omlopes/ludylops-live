import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import {
  deleteProductRecommendation,
  updateProductRecommendationStatus,
} from "@/lib/db/repository";
import { productRecommendationStatusSchema } from "@/lib/recommendation-schemas";

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
    const payload = productRecommendationStatusSchema.parse(await request.json());
    const updated = await updateProductRecommendationStatus({
      recommendationId: id,
      isActive: payload.isActive,
      category: payload.category,
    });

    return ok(updated);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    const message = error instanceof Error ? error.message : "Falha ao atualizar recomendação.";
    return fail(message, message === "recommendation_not_found" ? 404 : 400);
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
    const deleted = await deleteProductRecommendation(id);
    return ok(deleted);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao excluir recomendação.";
    return fail(message, message === "recommendation_not_found" ? 404 : 400);
  }
}
