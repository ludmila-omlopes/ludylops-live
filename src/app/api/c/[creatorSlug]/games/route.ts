import { suggestCommunityGameRequest } from "@/lib/creators/games-api";

export async function POST(request: Request, { params }: { params: Promise<{ creatorSlug: string }> }) {
  return suggestCommunityGameRequest(request, (await params).creatorSlug);
}
