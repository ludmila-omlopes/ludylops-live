import { ZodError } from "zod";
import { ensureViewerFromStreamerbotIdentity } from "@/lib/db/repository";
import type { CreatorContext } from "./context";
import { economyChannelMutationSchema, economyChannelSchema } from "./economy-input";
import { assertCreatorEconomyAccess, mutateCreatorEconomy, readCreatorEconomy, type EconomyAuthority } from "./economy";

export const economyReply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const messages: Record<string, string> = {
  insufficient_balance: "Saldo insuficiente nesta comunidade.",
  operation_conflict: "Esta operação já foi usada com outros valores.",
  already_refunded: "Este débito já foi estornado.",
  refund_unavailable: "Débito indisponível para estorno nesta comunidade.",
  balance_limit: "O valor ultrapassa o limite permitido.",
  viewer_not_found: "Espectador não encontrado.",
};
export function economyFailure(error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) return economyReply({ ok: false, error: "Confira o canal, o valor e o motivo informados." }, 400);
  const code = error instanceof Error ? error.message : "";
  if (messages[code]) return economyReply({ ok: false, error: messages[code] }, 409);
  if (["economy_unavailable", "legacy_economy_only"].includes(code)) return economyReply({ ok: false, error: "Moeda indisponível para esta comunidade." }, 403);
  return economyReply({ ok: false, error: "Não foi possível consultar a moeda agora. Tente novamente mais tarde." }, 503);
}
export async function mutateChannelEconomy(context: CreatorContext, authority: EconomyAuthority, input: unknown) {
  await assertCreatorEconomyAccess(context, authority);
  if (authority.kind === "viewer") throw new Error("economy_unavailable");
  const { viewerExternalId, youtubeDisplayName, ...operation } = economyChannelMutationSchema.parse(input);
  const viewer = await ensureViewerFromStreamerbotIdentity({ viewerExternalId, youtubeDisplayName, initializeBalance: false });
  return mutateCreatorEconomy(context, authority, { ...operation, viewerId: viewer.id });
}

export async function readIntegrationChannelEconomy(context: CreatorContext, input: { viewerExternalId: string; youtubeDisplayName?: string }) {
  await assertCreatorEconomyAccess(context, { kind: "integration" });
  const viewer = await ensureViewerFromStreamerbotIdentity({ ...economyChannelSchema.parse(input), initializeBalance: false });
  return readCreatorEconomy(context, { kind: "integration" }, viewer.id);
}
