import { voteCommunityVideoRequest } from "@/lib/creators/videos-api";

type Context = { params: Promise<{ creatorSlug: string; id: string }> };

export async function POST(request: Request, { params }: Context) {
  return voteCommunityVideoRequest(request, await params, true);
}

export async function DELETE(request: Request, { params }: Context) {
  return voteCommunityVideoRequest(request, await params, false);
}
