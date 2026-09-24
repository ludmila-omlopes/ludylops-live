import { z } from "zod";
import { requireApiSession, isTrustedAppMutationRequest } from "@/lib/api";
import { CredentialOperationError, issueStreamerbotCredential, listOwnedStreamerbotCredentials, revokeStreamerbotCredential } from "@/lib/streamerbot/credentials";
import { credentialIdPattern } from "@/lib/streamerbot/credential-crypto";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create") }).strict(),
  z.object({ action: z.literal("rotate"), credentialId: z.string().regex(credentialIdPattern) }).strict(),
  z.object({ action: z.literal("revoke"), credentialId: z.string().regex(credentialIdPattern) }).strict(),
]);
type Context = { params: Promise<{ id: string }> };
function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
}
function failure(error: unknown) {
  if (error instanceof CredentialOperationError) return reply({ ok: false, error: error.message }, error.status);
  return reply({ ok: false, error: "Credenciais indisponíveis. Tente novamente mais tarde ou peça ajuda à administração." }, 503);
}
export async function GET(_request: Request, { params }: Context) {
  try {
    const viewerId = (await requireApiSession())?.user?.activeViewerId;
    if (!viewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    return reply({ ok: true, data: await listOwnedStreamerbotCredentials((await params).id, viewerId) });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const viewerId = (await requireApiSession())?.user?.activeViewerId;
    if (!viewerId) return reply({ ok: false, error: "Entre novamente para continuar." }, 401);
    if (!isTrustedAppMutationRequest(request)) return reply({ ok: false, error: "Origem inválida." }, 403);
    const payload = mutationSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) return reply({ ok: false, error: "Solicitação inválida." }, 400);
    const { id } = await params;
    const authority = { kind: "owner" as const, viewerId };
    if (payload.data.action === "revoke") return reply({ ok: true, data: await revokeStreamerbotCredential(id, payload.data.credentialId, authority) });
    return reply({ ok: true, data: await issueStreamerbotCredential(id, payload.data.action === "rotate" ? payload.data.credentialId : undefined, authority) }, 201);
  } catch (error) { return failure(error); }
}
