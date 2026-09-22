import { guardModuleRequest } from '@/lib/creators/module-access';
import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { adjustViewerBalance } from "@/lib/db/repository";
import { manualAdjustSchema } from "@/lib/streamerbot/schemas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const moduleDenial = await guardModuleRequest(request, ["points"]);
  if (moduleDenial) return moduleDenial;

  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }
  const { id } = await params;
  const payload = manualAdjustSchema.parse(await request.json());
  await adjustViewerBalance({
    viewerId: id,
    amount: payload.amount,
    reason: payload.reason,
  });
  return ok({ viewerId: id, amount: payload.amount });
}
