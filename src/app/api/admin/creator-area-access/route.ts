import { ZodError } from "zod";

import { fail, isTrustedAppMutationRequest, ok, requireAdminApiSession } from "@/lib/api";
import {
  getCreatorAreaAccessSettings,
  parseCreatorAreaAccessText,
  updateCreatorAreaAccessSettings,
} from "@/lib/creators/access";

export async function GET() {
  const session = await requireAdminApiSession();
  if (!session) {
    return fail("Forbidden", 403);
  }

  return ok(await getCreatorAreaAccessSettings());
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
    const payload = (await request.json()) as { allowedEmails?: unknown; emailsText?: unknown };
    const allowedEmails = Array.isArray(payload.allowedEmails)
      ? payload.allowedEmails
      : typeof payload.emailsText === "string"
        ? parseCreatorAreaAccessText(payload.emailsText)
        : [];

    const settings = await updateCreatorAreaAccessSettings({
      allowedEmails: allowedEmails.map(String),
      updatedBy: session.user?.email?.toLowerCase() ?? null,
    });

    return ok(settings);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fail("Payload inválido.", 400);
    }

    if (error instanceof ZodError) {
      return fail(error.issues[0]?.message ?? "Lista de emails inválida.", 400);
    }

    return fail(error instanceof Error ? error.message : "Falha ao salvar lista.", 400);
  }
}
