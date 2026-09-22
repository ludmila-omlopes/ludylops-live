import { guardVerifiedModules } from "@/lib/creators/module-access";
import { defaultCreatorContext } from "@/lib/creators/context";
import { fail, ok } from "@/lib/api";
import { bridgeFail } from "@/lib/db/repository";
import { env } from "@/lib/env";
import { bridgeFailSchema } from "@/lib/streamerbot/schemas";
import { verifySignedRequest } from "@/lib/streamerbot/security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ redemptionId: string }> },
) {
  const raw = await request.text();
  const valid = verifySignedRequest({
    body: raw,
    timestamp: request.headers.get("x-timestamp"),
    signature: request.headers.get("x-signature"),
    secret: env.BRIDGE_SHARED_SECRET,
  });
  if (!valid) {
    return fail("Invalid signature.", 401);
  }
  const moduleDenial = await guardVerifiedModules(defaultCreatorContext, ["redemptions"]);
  if (moduleDenial) return moduleDenial;
  const payload = bridgeFailSchema.parse(JSON.parse(raw));
  const { redemptionId } = await params;
  return ok(await bridgeFail(redemptionId, payload.failureReason));
}
