import { ZodError } from "zod";
import { requireApiSession, requireAdminApiSession, isTrustedAppMutationRequest } from "@/lib/api";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { PeriodicAccessError, PeriodicConflictError } from "./periodic-messages";
import { getPeriodicMessages, editPeriodicMessages, type PeriodicActor } from "./periodic-messages.server";

export function periodicReply(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
export function periodicFailure(error: unknown) {
  if (error instanceof PeriodicAccessError) return periodicReply({ ok: false, error: "Mensagens indisponíveis para esta comunidade." }, 404);
  if (error instanceof PeriodicConflictError) return periodicReply({ ok: false, error: error.message }, 409);
  if (error instanceof ZodError || error instanceof SyntaxError) return periodicReply({ ok: false, error: "Use até 200 caracteres, sem quebras de linha, e um intervalo de 60 a 86.400 segundos." }, 400);
  return periodicReply({ ok: false, error: "Não foi possível acessar as mensagens. Tente novamente." }, 503);
}
export async function periodicOwnerRequest(request: Request, creatorId?: string) {
  try {
    if (request.method !== "GET" && !isTrustedAppMutationRequest(request)) return periodicReply({ ok: false, error: "Origem inválida." }, 403);
    const session = creatorId ? await requireApiSession() : await requireAdminApiSession();
    if (!session?.user?.activeViewerId) return periodicReply({ ok: false, error: "Entre com uma conta autorizada." }, 401);
    const actor: PeriodicActor = creatorId ? { kind: "owner", ownerId: session.user.activeViewerId } : { kind: "admin" };
    const context = { creatorId: creatorId ?? DEFAULT_CREATOR_ID };
    const data = request.method === "GET" ? await getPeriodicMessages(context, actor) : await editPeriodicMessages(context, actor, await request.json());
    return periodicReply({ ok: true, data });
  } catch (error) { return periodicFailure(error); }
}
