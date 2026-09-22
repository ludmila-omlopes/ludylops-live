import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { env } from "@/lib/env";
import { credentialIdPattern, decryptCredentialSecret, verifyCredentialSignature } from "@/lib/streamerbot/credential-crypto";
import { credentialIsUsable, findStreamerbotCredential, markStreamerbotCredentialUsed, streamerbotCreatorIsEnabled } from "@/lib/streamerbot/credentials";
import { verifySignedRequest } from "@/lib/streamerbot/security";

type AuthenticatedStreamerbot = { ok: true; raw: string; creatorId: string; credentialId: string | null; mode: "credential" | "legacy" };
type AuthenticationResult = AuthenticatedStreamerbot | { ok: false; response: Response };

function denied(status: number, error: string, replyMessage: string): AuthenticationResult {
  return { ok: false, response: Response.json({ ok: false, error, replyMessage }, { status, headers: { "Cache-Control": "no-store" } }) };
}

export async function authenticateStreamerbotRequest(request: Request): Promise<AuthenticationResult> {
  try {
    const raw = await request.text();
    const timestamp = request.headers.get("x-timestamp");
    const signature = request.headers.get("x-signature");
    const id = request.headers.get("x-streamerbot-credential-id");
    let creatorId = DEFAULT_CREATOR_ID;
    const invalid = () => denied(401, "Invalid signature.", "Assinatura inválida na integração com Streamer.bot.");
    if (id !== null) {
      // A malformed/unknown ID never downgrades to the global secret.
      if (!credentialIdPattern.test(id) || !timestamp || !signature) return invalid();
      const record = await findStreamerbotCredential(id);
      if (!record || !credentialIsUsable(record)) return invalid();
      const secret = decryptCredentialSecret(record.encryptedSecret, record.id, record.creatorId, env.STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY);
      if (!verifyCredentialSignature({ credentialId: id, timestamp, signature, secret, body: raw, method: request.method, pathname: new URL(request.url).pathname })) return invalid();
      creatorId = record.creatorId;
    } else {
      if (env.STREAMERBOT_LEGACY_AUTH_ENABLED === "false" || !verifySignedRequest({ body: raw, timestamp, signature, secret: env.STREAMERBOT_SHARED_SECRET })) return invalid();
    }
    if (!await streamerbotCreatorIsEnabled(creatorId)) return denied(403, "creator_unavailable", "A integração com Streamer.bot está desativada para este streamer.");
    if (id) await markStreamerbotCredentialUsed(id, new Date());
    // Fixed fields only: no payload, signatures, secrets, or request-derived hostnames.
    console.info("[streamerbot/auth] authenticated", { mode: id ? "credential" : "legacy", creatorId, credentialId: id });
    return { ok: true, raw, creatorId, credentialId: id, mode: id ? "credential" : "legacy" };
  } catch {
    console.error("[streamerbot/auth] authentication_unavailable");
    return denied(503, "authentication_unavailable", "Não foi possível verificar a integração agora.");
  }
}

export type StreamerbotOperation = "events" | "link" | "points" | "bets.place" | "counters" | "deaths" | "quotes.legacy" | "quotes.create" | "quotes.get" | "wheel";

/** Explicit rollout boundary. Future scoped actions need their own entry and tests. */
export function authorizeStreamerbotOperation(context: AuthenticatedStreamerbot, operation: StreamerbotOperation): Response | null {
  if (operation === "quotes.create" || operation === "quotes.get") return null;
  const legacyOperations: readonly StreamerbotOperation[] = ["events", "link", "points", "bets.place", "counters", "deaths", "quotes.legacy", "wheel"];
  if (context.creatorId === DEFAULT_CREATOR_ID && legacyOperations.includes(operation)) return null;
  return Response.json({ ok: false, error: "operation_not_isolated", replyMessage: "Este comando ainda não está disponível para este streamer." }, { status: 403 });
}
