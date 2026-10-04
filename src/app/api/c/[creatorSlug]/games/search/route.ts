import { searchCommunityGamesRequest } from "@/lib/creators/games-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ creatorSlug: string }> }) {
  return searchCommunityGamesRequest(request, (await params).creatorSlug);
}
