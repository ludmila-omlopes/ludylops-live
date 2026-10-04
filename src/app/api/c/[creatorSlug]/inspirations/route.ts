import { suggestCommunityInspirationRequest } from "@/lib/creators/inspirations-api";

export async function POST(request: Request, { params }: { params: Promise<{ creatorSlug: string }> }) {
  return suggestCommunityInspirationRequest(request, (await params).creatorSlug);
}
