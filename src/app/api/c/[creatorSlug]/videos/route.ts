import { suggestCommunityVideoRequest } from "@/lib/creators/videos-api";

export async function POST(request: Request, { params }: { params: Promise<{ creatorSlug: string }> }) {
  return suggestCommunityVideoRequest(request, (await params).creatorSlug);
}
