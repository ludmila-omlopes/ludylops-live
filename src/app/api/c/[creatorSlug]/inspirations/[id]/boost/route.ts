import { boostInspirationRequest } from "@/lib/creators/inspirations-api";

export async function POST(request: Request, { params }: { params: Promise<{ creatorSlug: string; id: string }> }) {
  return boostInspirationRequest(request, await params);
}
