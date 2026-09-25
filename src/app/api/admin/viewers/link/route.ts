import { guardModuleRequest } from '@/lib/creators/module-access';
import { ZodError, z } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { adminLinkGoogleViewerToYoutubeViewer } from "@/lib/db/repository";

const adminViewerLinkSchema = z.object({
  sourceViewerId: z.string().uuid(),
  targetViewerId: z.string().uuid(),
  confirmationText: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["points","streamerbot"]);
  if (moduleDenial) return moduleDenial;

  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const payload = adminViewerLinkSchema.parse(await request.json());
    if (payload.confirmationText.toUpperCase() !== "VINCULAR") {
      return fail('Digite "VINCULAR" para confirmar a operação.', 400);
    }

    const result = await adminLinkGoogleViewerToYoutubeViewer({
      sourceViewerId: payload.sourceViewerId,
      targetViewerId: payload.targetViewerId,
    });

    return ok(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return fail("Payload inválido.", 400);
    }
    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    const message = error instanceof Error ? error.message : "Falha ao vincular usuários.";
    return fail(message, 400);
  }
}
