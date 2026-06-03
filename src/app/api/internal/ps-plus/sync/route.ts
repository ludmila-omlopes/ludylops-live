import { env } from "@/lib/env";
import { fail, ok } from "@/lib/api";
import { syncPsPlusDeluxeCatalog } from "@/lib/db/repository";

function isAuthorized(request: Request) {
  const secret = env.PS_PLUS_SYNC_SECRET;
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    console.warn("[ps-plus/sync] Unauthorized sync request.", {
      hasSecret: Boolean(env.PS_PLUS_SYNC_SECRET),
    });
    return fail("Unauthorized", 401);
  }

  try {
    const result = await syncPsPlusDeluxeCatalog({ force: true });
    console.info("[ps-plus/sync] Catalog sync completed.", result);
    return ok(result);
  } catch (error) {
    console.error("[ps-plus/sync] Catalog sync failed.", error);
    return fail("Falha ao sincronizar catálogo PS Plus.", 502);
  }
}
