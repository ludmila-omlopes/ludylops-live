import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { canUseModules } from "./module-access";
import { resolvePublicCreatorFromRequest } from "./tenant";
import { DEFAULT_CREATOR_ID } from "./defaults";
import type { CreatorModuleKey } from "./modules";

export async function resolveLegacyModulePage() {
  const tenant = await resolvePublicCreatorFromRequest({
    request: new Request("http://internal/", { headers: await headers() }),
    pathname: "/",
  });
  if (
    !tenant ||
    tenant.creator.id !== DEFAULT_CREATOR_ID ||
    tenant.creator.status !== "active"
  )
    notFound();
  return {
    tenant,
    can: (...keys: CreatorModuleKey[]) => canUseModules(tenant, keys),
  };
}

export async function requireModulePage(keys: readonly CreatorModuleKey[]) {
  const { tenant } = await resolveLegacyModulePage();
  if (!canUseModules(tenant, keys)) notFound();
  return tenant;
}
