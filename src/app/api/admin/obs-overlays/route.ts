import { z } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import {
  cancelQueuedQuoteOverlays,
  getObsOverlayAdminStatus,
  setObsOverlayPaused,
} from "@/lib/db/repository";
import { updateObsOverlayStyleConfig } from "@/lib/obs-overlay-settings";

const obsOverlayActionSchema = z.object({
  action: z.enum(["pause", "resume", "cancel_queue", "set_style"]),
  style: z.enum(["classic", "obscur"]).optional(),
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
    if (parsed.data.action === "set_style") {
      if (!parsed.data.style) {
        return fail("Escolha um estilo de overlay.", 400);
      }

      await updateObsOverlayStyleConfig({ style: parsed.data.style, updatedBy });
      return ok(await getObsOverlayAdminStatus());
    }

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
