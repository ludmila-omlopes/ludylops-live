import { guardModuleRequest } from '@/lib/creators/module-access';
import { fail, ok, requireApiSession } from "@/lib/api";
import { getViewerPoints } from "@/lib/db/repository";

export async function GET(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["points"]);
  if (moduleDenial) return moduleDenial;

  const session = await requireApiSession();
  if (!session?.user?.activeViewerId) {
    return fail("Unauthorized", 401);
  }
  const dashboard = await getViewerPoints(session.user.activeViewerId);
  return ok(dashboard?.balance ?? null);
}
