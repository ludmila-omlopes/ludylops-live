import { guardModuleRequest } from '@/lib/creators/module-access';
import { z } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import {
  clearStreamerbotLivestreamManualOverride,
  setStreamerbotLivestreamManualOverride,
} from "@/lib/streamerbot/live-status";

const liveStatusActionSchema = z.object({
  action: z.enum(["force_online", "force_offline", "clear_override"]),
  confirmationText: z.string().trim().min(1, 'Digite a confirmação.'),
});

const confirmationKeywords = {
  force_online: "ONLINE",
  force_offline: "OFFLINE",
  clear_override: "AUTO",
} as const;

export async function POST(request: Request) {
  const moduleDenial = await guardModuleRequest(request, ["streamerbot"]);
  if (moduleDenial) return moduleDenial;

  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const json = await request.json();
    const parsed = liveStatusActionSchema.safeParse(json);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Payload inválido.", 400);
    }

    const expectedKeyword = confirmationKeywords[parsed.data.action];
    if (parsed.data.confirmationText.trim().toUpperCase() !== expectedKeyword) {
      return fail(`Digite "${expectedKeyword}" para confirmar.`, 400);
    }

    const updatedBy = session.user?.email?.toLowerCase() ?? null;

    const status =
      parsed.data.action === "force_online"
        ? await setStreamerbotLivestreamManualOverride({
            isLive: true,
            updatedBy,
          })
        : parsed.data.action === "force_offline"
          ? await setStreamerbotLivestreamManualOverride({
              isLive: false,
              updatedBy,
            })
          : await clearStreamerbotLivestreamManualOverride();

    return ok(status);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    return fail(error instanceof Error ? error.message : "Falha ao atualizar o status da live.", 400);
  }
}
