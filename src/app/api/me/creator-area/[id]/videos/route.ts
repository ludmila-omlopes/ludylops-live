import { ownerCommunityVideosRequest } from "@/lib/creators/videos-api";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  return ownerCommunityVideosRequest(request, (await params).id);
}

export async function PATCH(request: Request, { params }: Context) {
  return ownerCommunityVideosRequest(request, (await params).id);
}
