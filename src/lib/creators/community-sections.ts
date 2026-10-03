import { canUseModules, modulesAreAvailable } from "./module-access";
import { getModuleAvailability } from "./modules";
import {
  communitySectionLabels,
  communitySectionPath,
  type CommunitySectionKey,
} from "./owner-dashboard";

type SectionTenant = Parameters<typeof modulesAreAvailable>[0];

const sectionOrder: CommunitySectionKey[] = [
  "overview",
  "identidade",
  "modulos",
  "economia",
  "resgates",
  "frases",
  "produtos",
  "mensagens",
  "integracao",
];

/**
 * Presentation-level availability that mirrors the checks each owner API already enforces.
 * Hiding a section is not the authorization boundary; the section routes and APIs still check.
 */
export function isCommunitySectionAvailable(tenant: SectionTenant, section: CommunitySectionKey) {
  switch (section) {
    case "overview":
      return true;
    case "integracao":
      // Keep revocation available for inactive communities with an installed integration.
      return getModuleAvailability(tenant?.modules ?? [], "streamerbot").available;
    case "identidade":
    case "modulos":
      return tenant?.creator.status === "active";
    case "economia":
      return modulesAreAvailable(tenant, ["points"]);
    case "resgates":
      return canUseModules(tenant, ["redemptions"], "redemptions");
    case "frases":
      return canUseModules(tenant, ["quotes"], "quotes.manage");
    case "produtos":
      return canUseModules(tenant, ["product_recommendations"], "recommendations");
    case "mensagens":
      return canUseModules(tenant, ["streamerbot"], "periodic-messages");
  }
}

export function availableCommunitySections(tenant: SectionTenant, slug: string) {
  return sectionOrder
    .filter((section) => isCommunitySectionAvailable(tenant, section))
    .map((section) => ({
      key: section,
      label: communitySectionLabels[section],
      href: communitySectionPath(slug, section),
    }));
}
