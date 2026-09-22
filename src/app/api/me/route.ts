import { guardModuleRequest } from '@/lib/creators/module-access';
import { fail, ok, requireApiSession } from "@/lib/api";
import { getViewerDashboard } from "@/lib/db/repository";

export async function GET(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["points","redemptions"]);
  if (moduleDenial) return moduleDenial;

  const session = await requireApiSession();
  if (!session?.user?.activeViewerId) {
    return fail("Unauthorized", 401);
  }
  return ok(await getViewerDashboard(session.user.activeViewerId));
}
