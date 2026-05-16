import { ZodError } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { adjustViewerBalance } from "@/lib/db/repository";
import { adminAirdropSchema } from "@/lib/streamerbot/schemas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const { id } = await params;
    const payload = adminAirdropSchema.parse(await request.json());
    const viewerIds = [...new Set(payload.viewerIds?.length ? payload.viewerIds : [id])];

    for (const viewerId of viewerIds) {
      await adjustViewerBalance({
        viewerId,
        amount: payload.amount,
        reason: payload.reason,
        kind: "admin_airdrop",
        source: "admin_airdrop",
      });
    }

    return ok({ viewerIds, amount: payload.amount });
  } catch (error) {
    if (error instanceof ZodError) {
      return fail("Dados inválidos para o airdrop.", 400);
    }
    if (error instanceof Error && error.message === "viewer_not_found") {
      return fail("Usuário não encontrado.", 404);
    }
    throw error;
  }
}
