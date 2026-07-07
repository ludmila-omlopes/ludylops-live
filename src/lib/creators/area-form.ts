import { z, ZodError } from "zod";

import { DEFAULT_CREATOR_BRANDING } from "@/lib/creators/defaults";

// Client-safe validation and error formatting for the creator-area form.
// This module must NOT import server-only code (database client, env, node
// built-ins): it is bundled into the "use client" CreatorAreaCreateForm, and
// anything it pulls in ships to the browser. Keep the server logic in
// service.ts, which re-exports these helpers for its own use.

const creatorColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/u, "Use uma cor em hexadecimal, como #c7a2e9.");

export const createCreatorAreaSchema = z.object({
  displayName: z.string().trim().min(2, "Informe o nome do criador.").max(80, "Use até 80 caracteres."),
  slug: z.string().trim().max(64, "Use até 64 caracteres.").optional(),
  primaryColor: creatorColorSchema.default(DEFAULT_CREATOR_BRANDING.primaryColor),
  accentColor: creatorColorSchema.default(DEFAULT_CREATOR_BRANDING.accentColor),
});

export type CreateCreatorAreaInput = z.infer<typeof createCreatorAreaSchema>;

function formatCreatorAreaSchemaError(error: ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export function formatCreateCreatorAreaError(error: unknown) {
  if (error instanceof ZodError) {
    return formatCreatorAreaSchemaError(error);
  }

  const message = error instanceof Error ? error.message : "Falha ao criar área.";
  switch (message) {
    case "creator_slug_exists":
      return "Esse endereço já está em uso.";
    case "creator_slug_reserved":
      return "Esse endereço é reservado.";
    case "invalid_creator_slug":
      return "Use um endereço com letras, números e hífens.";
    case "missing_creator_owner":
      return "Entre novamente para criar a área.";
    case "creator_schema_missing":
      return "A estrutura de criadores ainda não foi aplicada no banco. Rode as migrações antes de criar áreas.";
    default:
      return message;
  }
}

export function flattenCreatorAreaSchemaErrors(error: ZodError) {
  return error.issues.reduce<Partial<Record<keyof CreateCreatorAreaInput, string>>>((acc, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && !acc[field as keyof CreateCreatorAreaInput]) {
      acc[field as keyof CreateCreatorAreaInput] = issue.message;
    }
    return acc;
  }, {});
}
