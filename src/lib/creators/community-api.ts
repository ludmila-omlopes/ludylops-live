import { isTrustedAppMutationRequest, requireApiSession } from "@/lib/api";
import { canUseModules, type ModuleOperation } from "./module-access";
import type { CreatorModuleKey } from "./modules";
import { getCreatorAreaBySlug } from "./service";

// Shared request steps for the community suggestion modules (videos, inspirations).

export const communityReply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export type CommunityViewerContext = { response: Response } | { creatorId: string; viewerId: string };

/**
 * Order matters: trusted origin for writes, then the community and its module
 * (404 before any session or storage), then the viewer's session.
 */
export async function communityViewerContext(
  request: Request,
  creatorSlug: string,
  module: { key: CreatorModuleKey; operation: ModuleOperation; unavailable: string; signIn?: string },
): Promise<CommunityViewerContext> {
  if (request.method !== "GET" && !isTrustedAppMutationRequest(request)) return { response: communityReply({ ok: false, error: "Origem inválida." }, 403) };
  const tenant = await getCreatorAreaBySlug(creatorSlug, { request });
  if (!tenant || !canUseModules(tenant, [module.key], module.operation)) return { response: communityReply({ ok: false, error: module.unavailable }, 404) };
  const viewerId = (await requireApiSession())?.user?.activeViewerId;
  if (!viewerId) return { response: communityReply({ ok: false, error: module.signIn ?? "Entre para sugerir e votar." }, 401) };
  return { creatorId: tenant.creator.id, viewerId };
}

/** The owner's own section: trusted origin for writes, then the session; ownership is checked in storage. */
export async function communityOwnerContext(request: Request): Promise<{ response: Response } | { ownerId: string }> {
  if (request.method !== "GET" && !isTrustedAppMutationRequest(request)) return { response: communityReply({ ok: false, error: "Origem inválida." }, 403) };
  const ownerId = (await requireApiSession())?.user?.activeViewerId;
  if (!ownerId) return { response: communityReply({ ok: false, error: "Entre novamente para continuar." }, 401) };
  return { ownerId };
}
