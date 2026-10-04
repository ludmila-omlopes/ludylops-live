import { ownerCommunityGamesRequest } from "@/lib/creators/games-api";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  return ownerCommunityGamesRequest(request, (await params).id);
}

export async function PATCH(request: Request, { params }: Context) {
  return ownerCommunityGamesRequest(request, (await params).id);
}
