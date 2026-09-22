import { guardModuleRequest } from '@/lib/creators/module-access';
import { fail, ok, requireAdminApiSession } from "@/lib/api";
import { listAdminGameSuggestions } from "@/lib/db/repository";

export async function GET(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["game_suggestions"]);
  if (moduleDenial) return moduleDenial;

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  return ok(await listAdminGameSuggestions());
}
