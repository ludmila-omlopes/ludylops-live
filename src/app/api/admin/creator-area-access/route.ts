import { z, ZodError } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import {
  getCreatorAreaAccessSettings,
  CreatorBetaConflictError,
  parseCreatorAreaAccessText,
  updateCreatorAreaAccessSettings,
} from "@/lib/creators/access";

export async function GET() {
  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    return ok(await getCreatorAreaAccessSettings(), { headers: { "cache-control": "no-store" } });
  } catch {
    return fail("Falha ao consultar os emails. Tente novamente.", 503);
  }
}

export async function PATCH(request: Request) {
  if (!isTrustedAppMutationRequest(request)) {
    return fail("Forbidden", 403);
  }

  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  try {
    const payload = z.object({
      allowedEmails: z.array(z.string()).optional(),
      emailsText: z.string().optional(),
      expectedUpdatedAt: z.string().datetime().nullable(),
    }).strict().refine((value) => value.allowedEmails !== undefined || value.emailsText !== undefined)
      .parse(await request.json());
    const allowedEmails = Array.isArray(payload.allowedEmails)
      ? payload.allowedEmails
      : typeof payload.emailsText === "string"
        ? parseCreatorAreaAccessText(payload.emailsText)
        : [];

    const settings = await updateCreatorAreaAccessSettings({
      allowedEmails: allowedEmails.map(String),
      updatedBy: session.user?.email?.toLowerCase() ?? null,
      expectedUpdatedAt: payload.expectedUpdatedAt,
    });

    return ok(settings);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    if (error instanceof ZodError) {
      return fail(error.issues[0]?.message ?? "Lista de emails inválida.", 400);
    }

    if (error instanceof CreatorBetaConflictError) return fail(error.message, 409);
    return fail("Falha ao salvar lista. Tente novamente.", 503);
  }
}
