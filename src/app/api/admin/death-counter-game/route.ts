import { guardModuleRequest } from '@/lib/creators/module-access';
import { z } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import {
  clearActiveDeathCounterGame,
  setActiveDeathCounterGame,
} from "@/lib/streamerbot/death-counter-game";

const deathCounterGameActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set"),
    gameName: z.string().trim().min(1, "Digite o nome do jogo."),
  }),
  z.object({
    action: z.literal("clear"),
  }),
]);

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
    const parsed = deathCounterGameActionSchema.safeParse(json);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Payload invalido.", 400);
    }

    const updatedBy = session.user?.email?.toLowerCase() ?? null;
    const data =
      parsed.data.action === "set"
        ? await setActiveDeathCounterGame({
            gameName: parsed.data.gameName,
            updatedBy,
          })
        : await clearActiveDeathCounterGame();

    return ok(data);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail("Payload invalido.", 400);
    }

    return fail(error instanceof Error ? error.message : "Falha ao atualizar o jogo ativo.", 400);
  }
}
