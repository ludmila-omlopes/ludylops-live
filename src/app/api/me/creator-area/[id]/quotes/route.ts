import { ZodError } from "zod";
import { isTrustedAppMutationRequest, requireApiSession } from "@/lib/api";
import { createOwnedQuote, listOwnedQuotes, QuoteManagementAccessError, QuoteManagementConflictError, updateOwnedQuote } from "@/lib/creators/quote-management.server";

type Context = { params: Promise<{ id: string }> };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function failure(error: unknown) {
  if (error instanceof QuoteManagementAccessError) return reply({ ok: false, error: "Frases indisponíveis para esta comunidade." }, 404);
  if (error instanceof QuoteManagementConflictError) return reply({ ok: false, error: "A frase mudou desde a última consulta. Atualize as frases antes de tentar novamente." }, 409);
  if (error instanceof ZodError || error instanceof SyntaxError) return reply({ ok: false, error: "Confira os dados. A frase deve ter de 1 a 500 caracteres." }, 400);
  return reply({ ok: false, error: "Não foi possível acessar as frases agora. Tente novamente mais tarde." }, 503);
}
export async function GET(request: Request, { params }: Context) {
  try {
    const session = await requireApiSession();
    if (!session?.user?.activeViewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    const query = new URL(request.url).searchParams;
    const cursor = query.getAll("before");
    if ([...query.keys()].some((key) => key !== "before") || cursor.length > 1 || (cursor.length && !/^[1-9]\d{0,9}$/.test(cursor[0])))
      return reply({ ok: false, error: "Consulta de frases inválida." }, 400);
    return reply({ ok: true, data: await listOwnedQuotes(session.user.activeViewerId, (await params).id, cursor.length ? Number(cursor[0]) : undefined) });
  } catch (error) { return failure(error); }
}
async function mutate(request: Request, { params }: Context, kind: "create" | "update") {
  try {
    if (!isTrustedAppMutationRequest(request)) return reply({ ok: false, error: "Origem inválida." }, 403);
    const session = await requireApiSession();
    if (!session?.user?.activeViewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    const operation = kind === "create" ? createOwnedQuote : updateOwnedQuote;
    return reply({ ok: true, data: await operation(session.user.activeViewerId, (await params).id, await request.json()) });
  } catch (error) { return failure(error); }
}
export const POST = (request: Request, context: Context) => mutate(request, context, "create");
export const PATCH = (request: Request, context: Context) => mutate(request, context, "update");
