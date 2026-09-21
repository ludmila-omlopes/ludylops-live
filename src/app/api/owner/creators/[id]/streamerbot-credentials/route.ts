import { z } from "zod";
import { requirePlatformOwnerApiSession, isTrustedAppMutationRequest } from "@/lib/api";
import { CredentialOperationError, issueStreamerbotCredential, listStreamerbotCredentials, revokeStreamerbotCredential } from "@/lib/streamerbot/credentials";
import { credentialIdPattern } from "@/lib/streamerbot/credential-crypto";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create") }).strict(),
  z.object({ action: z.literal("rotate"), credentialId: z.string().regex(credentialIdPattern) }).strict(),
  z.object({ action: z.literal("revoke"), credentialId: z.string().regex(credentialIdPattern) }).strict(),
]);
type Context = { params: Promise<{ id: string }> };

function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } });
}

function failure(error: unknown) {
  if (error instanceof CredentialOperationError) return reply({ ok: false, error: error.message }, error.status);
  // Database errors may contain encrypted secrets/query parameters. Never serialize/log them.
  return reply({ ok: false, error: "Credenciais indisponíveis. Verifique a migração e a chave de criptografia da aplicação." }, 503);
}

export async function GET(_request: Request, { params }: Context) {
  try {
    if (!await requirePlatformOwnerApiSession()) return reply({ ok: false, error: "Não autorizado." }, 401);
    const { id } = await params;
    return reply({ ok: true, data: await listStreamerbotCredentials(id) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    if (!await requirePlatformOwnerApiSession()) return reply({ ok: false, error: "Não autorizado." }, 401);
    if (!isTrustedAppMutationRequest(request)) return reply({ ok: false, error: "Origem inválida." }, 403);
    const payload = mutationSchema.safeParse(await request.json().catch(() => null));
    if (!payload.success) return reply({ ok: false, error: "Solicitação inválida." }, 400);
    const { id } = await params;
    if (payload.data.action === "revoke") return reply({ ok: true, data: await revokeStreamerbotCredential(id, payload.data.credentialId) });
    const created = await issueStreamerbotCredential(id, payload.data.action === "rotate" ? payload.data.credentialId : undefined);
    return reply({ ok: true, data: created }, 201);
  } catch (error) { return failure(error); }
}
