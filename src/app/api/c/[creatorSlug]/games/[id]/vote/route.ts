import { voteCommunityGameRequest } from "@/lib/creators/games-api";

type Context = { params: Promise<{ creatorSlug: string; id: string }> };

export async function POST(request: Request, { params }: Context) {
  return voteCommunityGameRequest(request, await params, true);
}

export async function DELETE(request: Request, { params }: Context) {
  return voteCommunityGameRequest(request, await params, false);
}
