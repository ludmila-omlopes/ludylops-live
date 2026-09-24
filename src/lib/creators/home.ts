import type { CreatorTenantRecord } from "@/lib/types";
import { env, isDemoMode } from "@/lib/env";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { getCurrencyLabel } from "./currency";
import { canUseModules } from "./module-access";

export function creatorHomeLinks(tenant: CreatorTenantRecord) {
  const legacy = tenant.creator.id === DEFAULT_CREATOR_ID;
  const prefix = `/c/${tenant.creator.slug}`;
  const currency = getCurrencyLabel(tenant.modules.find((m) => m.moduleKey === "points")?.configJson);
  const economy = legacy || isDemoMode || env.CREATOR_ECONOMY_ENABLED === "true";
  const links: { href: string; label: string; description: string }[] = [];
  if (economy && canUseModules(tenant, ["redemptions"], "redemptions"))
    links.push({ href: `${prefix}/resgates`, label: "Resgatar na live", description: `Troque seus ${currency} por momentos na live.` });
  if (economy && canUseModules(tenant, ["points"], legacy ? "legacy" : "economy"))
    links.push({ href: legacy ? "/me" : `${prefix}/moeda`, label: "Consultar minha moeda", description: `Seu saldo e suas movimentações em ${currency}.` });
  if (economy && canUseModules(tenant, ["ranking"], legacy ? "legacy" : "ranking.read"))
    links.push({ href: legacy ? "/ranking" : `${prefix}/ranking`, label: "Ver ranking", description: `Os maiores saldos de ${currency} da comunidade.` });
  if (canUseModules(tenant, ["quotes"], "quotes.read"))
    links.push({ href: legacy ? "/quotes" : `${prefix}/quotes`, label: "Frases da live", description: "As pérolas e as histórias que ficaram na memória." });
  if (canUseModules(tenant, ["product_recommendations"], legacy ? "legacy" : "recommendations"))
    links.push({ href: legacy ? "/produtinhos" : `${prefix}/produtinhos`, label: "Produtos indicados", description: "Escolhas para o setup, o jogo e o dia a dia." });
  return links;
}
