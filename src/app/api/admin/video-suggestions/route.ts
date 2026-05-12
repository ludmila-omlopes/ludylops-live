import { fail, ok, requireAdminApiSession } from "@/lib/api";
import { listAdminVideoSuggestions } from "@/lib/db/repository";

export async function GET() {
  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  return ok(await listAdminVideoSuggestions());
}
