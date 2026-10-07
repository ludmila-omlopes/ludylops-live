import { placeCommunityBetRequest } from "@/lib/creators/bets-api";

export async function POST(request: Request, { params }: { params: Promise<{ creatorSlug: string; id: string }> }) {
  return placeCommunityBetRequest(request, await params);
}
