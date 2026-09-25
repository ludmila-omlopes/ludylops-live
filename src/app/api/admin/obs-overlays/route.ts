import { guardModuleRequest } from '@/lib/creators/module-access';
import { defaultCreatorContext } from "@/lib/creators/context";
import { z } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import {
  cancelQueuedQuoteOverlays,
  getObsOverlayAdminStatus,
  setObsOverlayPaused,
} from "@/lib/db/repository";
import { updateObsOverlayStyleConfig } from "@/lib/obs-overlay-settings";
import { resolveQuoteRequest } from "@/lib/creators/quote-context";

const obsOverlayActionSchema = z.object({
  action: z.enum(["pause", "resume", "cancel_queue", "set_style"]),
  style: z.enum(["classic", "obscur"]).optional(),
});

export async function GET(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["quotes","obs_overlays"]);
  if (moduleDenial) return moduleDenial;

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  const tenant = await resolveQuoteRequest(request);
  if (!tenant || tenant.creator.id !== defaultCreatorContext.creatorId) return fail("creator_unavailable", 403);
  return ok(await getObsOverlayAdminStatus(defaultCreatorContext));
}

export async function POST(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["quotes","obs_overlays"]);
  if (moduleDenial) return moduleDenial;

  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const tenant = await resolveQuoteRequest(request);
    if (!tenant || tenant.creator.id !== defaultCreatorContext.creatorId) return fail("creator_unavailable", 403);
    const parsed = obsOverlayActionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Payload inválido.", 400);
    }

    const updatedBy = session.user?.email?.toLowerCase() ?? null;
    if (parsed.data.action === "set_style") {
      if (!parsed.data.style) {
        return fail("Escolha um estilo de overlay.", 400);
      }

      await updateObsOverlayStyleConfig({ style: parsed.data.style, updatedBy });
      return ok(await getObsOverlayAdminStatus(defaultCreatorContext));
    }

    const status =
      parsed.data.action === "pause"
        ? await setObsOverlayPaused(defaultCreatorContext, { paused: true, updatedBy })
        : parsed.data.action === "resume"
          ? await setObsOverlayPaused(defaultCreatorContext, { paused: false, updatedBy })
          : await cancelQueuedQuoteOverlays(defaultCreatorContext, { updatedBy });

    return ok(status);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    return fail(error instanceof Error ? error.message : "Falha ao atualizar overlays do OBS.", 400);
  }
}
