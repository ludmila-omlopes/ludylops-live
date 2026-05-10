import { z } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import {
  cancelQueuedQuoteOverlays,
  getObsOverlayAdminStatus,
  setObsOverlayPaused,
} from "@/lib/db/repository";

const obsOverlayActionSchema = z.object({
  action: z.enum(["pause", "resume", "cancel_queue"]),
});

export async function GET() {
  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  return ok(await getObsOverlayAdminStatus());
}

export async function POST(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const parsed = obsOverlayActionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Payload invalido.", 400);
    }

    const updatedBy = session.user?.email?.toLowerCase() ?? null;
    const status =
      parsed.data.action === "pause"
        ? await setObsOverlayPaused({ paused: true, updatedBy })
        : parsed.data.action === "resume"
          ? await setObsOverlayPaused({ paused: false, updatedBy })
          : await cancelQueuedQuoteOverlays({ updatedBy });

    return ok(status);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail("Payload invalido.", 400);
    }

    return fail(error instanceof Error ? error.message : "Falha ao atualizar overlays do OBS.", 400);
  }
}
