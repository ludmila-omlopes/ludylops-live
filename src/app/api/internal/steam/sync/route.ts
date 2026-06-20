import { env } from "@/lib/env";
import { fail, ok } from "@/lib/api";
import { syncSteamGameSuggestionPrices } from "@/lib/db/repository";
import { timingSafeStringEqual } from "@/lib/secure-compare";

function isAuthorized(request: Request) {
  const secret = env.STEAM_SYNC_SECRET;
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  return authorization !== null && timingSafeStringEqual(authorization, `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    console.warn("[steam/sync] Unauthorized sync request.", {
      hasSecret: Boolean(env.STEAM_SYNC_SECRET),
    });
    return fail("Unauthorized", 401);
  }

  try {
    const result = await syncSteamGameSuggestionPrices({ force: true });
    console.info("[steam/sync] Price sync completed.", result);
    return ok(result);
  } catch (error) {
    console.error("[steam/sync] Price sync failed.", error);
    return fail("Falha ao sincronizar preços da Steam.", 502);
  }
}
