import { voteCommunityInspirationRequest } from "@/lib/creators/inspirations-api";

type Context = { params: Promise<{ creatorSlug: string; id: string }> };

export async function POST(request: Request, { params }: Context) {
  return voteCommunityInspirationRequest(request, await params, true);
}

export async function DELETE(request: Request, { params }: Context) {
  return voteCommunityInspirationRequest(request, await params, false);
}
