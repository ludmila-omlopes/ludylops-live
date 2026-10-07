import { boostGameRequest } from "@/lib/creators/games-api";

export async function POST(request: Request, { params }: { params: Promise<{ creatorSlug: string; id: string }> }) {
  return boostGameRequest(request, await params);
}
