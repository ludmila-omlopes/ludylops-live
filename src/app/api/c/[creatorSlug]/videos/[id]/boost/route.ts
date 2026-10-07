import { boostVideoRequest } from "@/lib/creators/videos-api";

export async function POST(request: Request, { params }: { params: Promise<{ creatorSlug: string; id: string }> }) {
  return boostVideoRequest(request, await params);
}
