import { guardModuleRequest } from '@/lib/creators/module-access';
import { auth } from "@/auth";
import { ok } from "@/lib/api";
import { listBets } from "@/lib/db/repository";

export async function GET(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["bets"]);
  if (moduleDenial) return moduleDenial;

  const session = await auth();
  return ok(await listBets(session?.user?.activeViewerId ?? null));
}
