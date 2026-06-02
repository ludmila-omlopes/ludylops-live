import { fail, ok, requireApiSession } from "@/lib/api";
import { getViewerDashboard } from "@/lib/db/repository";

export async function GET() {
  const session = await requireApiSession();
  if (!session?.user?.activeViewerId) {
    return fail("Unauthorized", 401);
  }
  const dashboard = await getViewerDashboard(session.user.activeViewerId);
  return ok(dashboard?.spendingHistory ?? []);
}
