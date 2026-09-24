import { creatorRedemptionRequest } from "@/lib/creators/redemptions-api";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return creatorRedemptionRequest(request, await params);
}
