import { guardModuleRequest } from '@/lib/creators/module-access';
import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { bridgeComplete, bridgeFail } from "@/lib/db/repository";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const moduleDenial = await guardModuleRequest(request, ["redemptions"]);
  if (moduleDenial) return moduleDenial;

  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }
  const { id } = await params;
  const payload = (await request.json()) as { action?: "complete" | "fail"; failureReason?: string };

  if (payload.action === "complete") {
    return ok(await bridgeComplete(id));
  }

  if (payload.action === "fail") {
    return ok(await bridgeFail(id, payload.failureReason ?? "Marcado manualmente pelo admin."));
  }

  return fail("Ação inválida.", 400);
}
