import { ZodError } from "zod";
import { isTrustedAppMutationRequest, requireApiSession } from "@/lib/api";
import { listCreatorRecommendations, saveCreatorRecommendation, RecommendationAccessError, RecommendationConflictError } from "@/lib/creators/recommendations.server";
type Context = { params: Promise<{ id: string }> };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function failure(error: unknown) {
  if (error instanceof RecommendationAccessError) return reply({ ok: false, error: "Recomendações indisponíveis para esta comunidade." }, 404);
  if (error instanceof RecommendationConflictError) return reply({ ok: false, error: "O produto mudou desde a última consulta. Atualize os produtos antes de salvar." }, 409);
  if (error instanceof ZodError || error instanceof SyntaxError || (error instanceof Error && error.message === "invalid_cursor"))
    return reply({ ok: false, error: "Confira os dados do produto e use links válidos com http ou https." }, 400);
  return reply({ ok: false, error: "Não foi possível acessar as recomendações agora. Tente novamente mais tarde." }, 503);
}
export async function GET(request: Request, { params }: Context) {
  try {
    const session = await requireApiSession();
    if (!session?.user?.activeViewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some((key) => key !== "cursor") || query.getAll("cursor").length > 1) return reply({ ok: false, error: "Consulta inválida." }, 400);
    return reply({ ok: true, data: await listCreatorRecommendations((await params).id, session.user.activeViewerId, query.get("cursor") ?? undefined) });
  } catch (e) { return failure(e); }
}
async function mutate(request: Request, { params }: Context, updating: boolean) {
  try {
    if (!isTrustedAppMutationRequest(request)) return reply({ ok: false, error: "Origem inválida." }, 403);
    const session = await requireApiSession();
    if (!session?.user?.activeViewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    return reply({ ok: true, data: await saveCreatorRecommendation((await params).id, session.user.activeViewerId, await request.json(), updating) });
  } catch (e) { return failure(e); }
}
export const POST = (request: Request, context: Context) => mutate(request, context, false);
export const PATCH = (request: Request, context: Context) => mutate(request, context, true);
