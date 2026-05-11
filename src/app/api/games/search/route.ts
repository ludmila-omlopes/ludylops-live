import { fail, ok } from "@/lib/api";
import { isIgdbConfigured, searchIgdbGames } from "@/lib/igdb";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";

  if (query.trim().length < 2) {
    return ok([]);
  }

  if (!isIgdbConfigured()) {
    return ok([]);
  }

  try {
    return ok(await searchIgdbGames(query));
  } catch {
    return fail("igdb_unavailable", 503);
  }
}
