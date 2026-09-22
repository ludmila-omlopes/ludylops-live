import { guardModuleRequest } from '@/lib/creators/module-access';
import { fail, ok, requireApiSession } from "@/lib/api";
import { getViewerDashboard } from "@/lib/db/repository";

export async function GET(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["redemptions"]);
  if (moduleDenial) return moduleDenial;

  const session = await requireApiSession();
  if (!session?.user?.activeViewerId) {
    return fail("Unauthorized", 401);
  }
  const dashboard = await getViewerDashboard(session.user.activeViewerId);
  return ok(dashboard?.spendingHistory ?? []);
}
