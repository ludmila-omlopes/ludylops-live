import { ownerCommunityBetsRequest } from "@/lib/creators/bets-api";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  return ownerCommunityBetsRequest(request, (await params).id);
}

export async function POST(request: Request, { params }: Context) {
  return ownerCommunityBetsRequest(request, (await params).id);
}

export async function PATCH(request: Request, { params }: Context) {
  return ownerCommunityBetsRequest(request, (await params).id);
}
