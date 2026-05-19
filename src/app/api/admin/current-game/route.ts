import { z } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import { clearCurrentGame, setCurrentGame } from "@/lib/current-game";

const currentGameActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set"),
    igdbId: z.number().int().positive(),
    name: z.string().trim().min(1, "Digite o nome do jogo."),
    releaseYear: z.number().int().positive().nullable(),
    coverImageUrl: z.string().url().nullable(),
    platforms: z.array(z.string().trim().min(1)).default([]),
    genres: z.array(z.string().trim().min(1)).default([]),
  }),
  z.object({
    action: z.literal("clear"),
  }),
]);

export async function POST(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const json = await request.json();
    const parsed = currentGameActionSchema.safeParse(json);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Payload inválido.", 400);
    }

    const updatedBy = session.user?.email?.toLowerCase() ?? null;
    const data =
      parsed.data.action === "set"
        ? await setCurrentGame({
            igdbId: parsed.data.igdbId,
            name: parsed.data.name,
            releaseYear: parsed.data.releaseYear,
            coverImageUrl: parsed.data.coverImageUrl,
            platforms: parsed.data.platforms,
            genres: parsed.data.genres,
            updatedBy,
          })
        : await clearCurrentGame();

    return ok(data);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    return fail(error instanceof Error ? error.message : "Falha ao atualizar o jogo atual.", 400);
  }
}
