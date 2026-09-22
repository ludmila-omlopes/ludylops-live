import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creators, creatorModules } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import {
  defaultCreatorTenant,
  resolvePublicCreatorFromRequest,
} from "./tenant";
import { listDemoCreatorTenants } from "./demo-store";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { getModuleAvailability, type CreatorModuleKey } from "./modules";
import type { CreatorContext } from "./context";

type ModuleTenant = {
  creator: { id: string; status: string };
  modules: { moduleKey: string; status: string }[];
};
export type ModuleOperation = "legacy" | "quotes.read" | "quotes.create";

/** Lifecycle/dependency check for configuration and authentication, without granting data access. */
export function modulesAreAvailable(
  tenant: ModuleTenant | null,
  keys: readonly CreatorModuleKey[],
) {
  return Boolean(
    tenant &&
      tenant.creator.status === "active" &&
      keys.length &&
      keys.every((key) => getModuleAvailability(tenant.modules, key).available),
  );
}

/** Configuration availability is distinct from permission to operate unscoped storage. */
export function canUseModules(
  tenant: ModuleTenant | null,
  keys: readonly CreatorModuleKey[],
  operation: ModuleOperation = "legacy",
) {
  if (!tenant || !modulesAreAvailable(tenant, keys)) return false;
  if (tenant.creator.id === DEFAULT_CREATOR_ID) return true;
  return (
    (operation === "quotes.read" || operation === "quotes.create") &&
    keys.every((key) => key === "quotes")
  );
}

/** ID must come from verified integration credentials or an authorized server adapter. */
export async function loadModuleTenant(
  context: CreatorContext,
): Promise<ModuleTenant | null> {
  if (!context?.creatorId) return null;
  if (isDemoMode)
    return (
      listDemoCreatorTenants().find(
        (tenant) => tenant.creator.id === context.creatorId,
      ) ??
      (context.creatorId === DEFAULT_CREATOR_ID ? defaultCreatorTenant : null)
    );
  const db = getDb();
  if (!db) throw new Error("module_policy_unavailable");
  const [creator] = await db
    .select({ id: creators.id, status: creators.status })
    .from(creators)
    .where(eq(creators.id, context.creatorId));
  if (!creator) return null;
  const modules = await db
    .select({
      moduleKey: creatorModules.moduleKey,
      status: creatorModules.status,
    })
    .from(creatorModules)
    .where(eq(creatorModules.creatorId, creator.id));
  return { creator, modules };
}

export function moduleUnavailable(status = 403) {
  return Response.json(
    {
      ok: false,
      error:
        status === 503 ? "module_policy_unavailable" : "module_unavailable",
      replyMessage: "Este recurso está indisponível para esta comunidade.",
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function guardVerifiedModules(
  context: CreatorContext,
  keys: readonly CreatorModuleKey[],
  operation: ModuleOperation = "legacy",
) {
  try {
    return canUseModules(await loadModuleTenant(context), keys, operation)
      ? null
      : moduleUnavailable();
  } catch {
    return moduleUnavailable(503);
  }
}

export async function guardModuleRequest(
  request: Request,
  keys: readonly CreatorModuleKey[],
) {
  try {
    const slugs = new URL(request.url).searchParams.getAll("creator");
    if (slugs.length > 1) return moduleUnavailable();
    const tenant = await resolvePublicCreatorFromRequest({
      request,
      pathname: "/",
      ...(slugs.length ? { slug: slugs[0] } : {}),
    });
    return canUseModules(tenant, keys) ? null : moduleUnavailable();
  } catch {
    return moduleUnavailable(503);
  }
}
