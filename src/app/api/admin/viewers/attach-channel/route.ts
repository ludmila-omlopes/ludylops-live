import { ZodError, z } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { adminAttachYoutubeChannelToGoogleAccount } from "@/lib/db/repository";

const adminAttachChannelSchema = z.object({
  googleAccountId: z.string().min(1),
  viewerId: z.string().uuid(),
  confirmationText: z.string().trim().min(1),
});

export async function POST(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const payload = adminAttachChannelSchema.parse(await request.json());
    if (payload.confirmationText.toUpperCase() !== "VINCULAR") {
      return fail('Digite "VINCULAR" para confirmar a operação.', 400);
    }

    const result = await adminAttachYoutubeChannelToGoogleAccount({
      googleAccountId: payload.googleAccountId,
      viewerId: payload.viewerId,
    });

    return ok(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return fail("Payload inválido.", 400);
    }
    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    const message = error instanceof Error ? error.message : "Falha ao adicionar canal.";
    return fail(message, 400);
  }
}
