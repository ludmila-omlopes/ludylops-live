import { guardModuleRequest } from '@/lib/creators/module-access';
import { ok } from "@/lib/api";
import { getLeaderboard } from "@/lib/db/repository";

export async function GET(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["ranking"]);
  if (moduleDenial) return moduleDenial;

  return ok(await getLeaderboard());
}
