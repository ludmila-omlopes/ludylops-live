import { formatDuration } from "@/lib/duration";
import { getChatRewardSettings } from "./chat-rewards";
import { getCurrencyLabel } from "./currency";
import { modulesAreAvailable } from "./module-access";
import { describeModuleChoices, hasConfirmedModuleChoice, joinModuleLabels } from "./module-choices";
import { getModuleAvailability, hasLiveModules } from "./modules";
import { communitySectionPath } from "./owner-dashboard";

export type SetupFacts = {
  creator: { id: string; slug: string; displayName: string; status: string };
  modules: { moduleKey: string; status: string; configJson: unknown }[];
  economyEnabled: boolean;
  credentials: { usable: number; lastUsedAt: string | null } | null;
  catalog: { total: number; available: number; completed: number } | null;
  /** Published product recommendations; null when they could not be read or the module is off. */
  products?: { published: number } | null;
};
export type SetupStep = { id: string; title: string; state: "configured" | "pending" | "blocked" | "verify"; detail: string; href?: string; link?: string };
/** `live` is false for a community that only has its own page: its checklist skips currency and Streamer.bot. */
export type CreatorSetup = { displayName: string; active: boolean; live: boolean; currencyLabel: string; steps: SetupStep[] };
const inactiveDetail = "Sua comunidade está desativada. Peça ajuda à administração para retomar.";
const disabledDetail = "Este recurso está desativado para sua comunidade. Peça ajuda à administração.";
/** Configured once the creator saves a choice; the products installed at creation do not count. */
function modulesStep(facts: SetupFacts, active: boolean, href: string): SetupStep {
  const choices = describeModuleChoices(facts.modules).filter((choice) => choice.chosen);
  const summary = [
    ["Ativos agora", choices.filter((choice) => choice.state === "active")],
    ["Em breve", choices.filter((choice) => choice.state === "soon")],
  ] as const;
  const confirmed = hasConfirmedModuleChoice(facts.modules);
  return { id: "modules", title: "Módulos da página", state: !active ? "blocked" : confirmed ? "configured" : "pending", detail: !active ? inactiveDetail : confirmed ? summary.filter(([, list]) => list.length).map(([label, list]) => `${label}: ${joinModuleLabels(list.map((choice) => choice.key))}.`).join(" ") : "Escolha o que seu público vai encontrar: produtos indicados, sugestões de jogos, vídeos para reagir, apostas e mais.", href, link: "Escolher módulos" };
}
function buildPageSetup(facts: SetupFacts, currencyLabel: string): CreatorSetup {
  const { creator, products } = facts;
  const active = creator.status === "active";
  const available = modulesAreAvailable(facts, ["product_recommendations"]);
  // A creator who left products out of their choice skips the products step.
  const productsChosen = facts.modules.some((module) => module.moduleKey === "product_recommendations" && module.status !== "requested");
  const section = (key: Parameters<typeof communitySectionPath>[1]) => communitySectionPath(creator.slug, key);
  const productCount = products?.published === 1 ? "1 produto publicado" : `${products?.published ?? 0} produtos publicados`;
  const steps: SetupStep[] = [
    { id: "profile", title: "Nome e cores", state: active ? "configured" : "blocked", detail: active ? `${creator.displayName}. Confira o nome e as cores que seu público vai ver.` : inactiveDetail, href: section("identidade"), link: "Revisar nome e cores" },
    modulesStep(facts, active, section("modulos")),
    ...(productsChosen ? [{ id: "products", title: "Primeiros produtos", state: !active || !available || !products ? "blocked" : products.published ? "configured" : "pending", detail: !active ? inactiveDetail : !available ? disabledDetail : !products ? "Não foi possível consultar seus produtos." : products.published ? `${productCount}. Mantenha os links e as descrições atualizados.` : "Indique o primeiro produto com o link da loja ou o seu link de afiliado.", ...(available ? { href: section("produtos"), link: "Indicar produtos" } : {}) } satisfies SetupStep] : []),
    { id: "share", title: "Divulgue o endereço", state: active ? "verify" : "blocked", detail: active ? "Coloque o endereço na bio, na descrição dos vídeos e nos links do canal para seu público encontrar suas indicações." : inactiveDetail },
  ];
  return { displayName: creator.displayName, active, live: false, currencyLabel, steps: active ? steps : steps.map((step) => ({ ...step, href: undefined, link: undefined })) };
}
export function buildCreatorSetup(facts: SetupFacts): CreatorSetup {
  const { creator, modules, credentials, catalog } = facts;
  const active = creator.status === "active", points = modules.find(m => m.moduleKey === "points");
  const config = points?.configJson as Record<string, unknown> | undefined;
  const currencyLabel = getCurrencyLabel(config), chat = getChatRewardSettings(config);
  if (!hasLiveModules(modules)) return buildPageSetup(facts, currencyLabel);
  const economy = facts.economyEnabled && modulesAreAvailable(facts, ["points"]);
  const integration = modulesAreAvailable(facts, ["streamerbot"]);
  const integrationInstalled = getModuleAvailability(modules, "streamerbot").available;
  const redemptions = facts.economyEnabled && modulesAreAvailable(facts, ["redemptions"]);
  const section = (key: Parameters<typeof communitySectionPath>[1]) => communitySectionPath(creator.slug, key);
  const blocked = !active ? inactiveDetail : !facts.economyEnabled ? "A moeda ainda aguarda liberação para uso. Peça ajuda à administração." : disabledDetail;
  return { displayName: creator.displayName, active, live: true, currencyLabel, steps: [
    { id: "profile", title: "Nome e moeda", state: active ? "configured" : "blocked", detail: active ? `${creator.displayName} · ${currencyLabel}. Confira o nome e as cores que sua comunidade vai usar.` : blocked, href: section("identidade"), link: "Revisar nome e cores" },
    { id: "economy", title: "Moeda disponível", state: economy ? "configured" : "blocked", detail: economy ? `Saldo e movimentações em ${currencyLabel} estão disponíveis. Cada streamer mantém sua própria moeda.` : blocked, ...(economy ? { href: section("economia"), link: "Conferir moeda e ganhos" } : {}) },
    { id: "credential", title: "Credencial exclusiva", state: !integration || !credentials ? "blocked" : credentials.usable ? "configured" : "pending", detail: !integration ? blocked : !credentials ? "A emissão de credenciais não está disponível neste ambiente." : credentials.usable ? "Você tem uma credencial válida. Isso não confirma que o Streamer.bot esteja configurado." : "Crie uma credencial e salve o ID e o segredo no seu Streamer.bot.", ...(integrationInstalled ? { href: section("integracao"), link: "Gerenciar credenciais" } : {}) },
    { id: "authentication", title: "Autenticação recebida", state: integration && credentials?.lastUsedAt ? "configured" : "pending", detail: integration && credentials?.lastUsedAt ? `Última autenticação de uma credencial válida: ${credentials.lastUsedAt}. Ela não confirma conexão contínua nem execução de ações.` : "Execute check-credential.cs no seu Streamer.bot e confira o ID da sua comunidade no resultado. Depois atualize esta verificação." },
    { id: "chat", title: "Ganhos por mensagem", state: !economy || !integration ? "blocked" : chat.enabled ? "verify" : "pending", detail: !economy || !integration ? blocked : chat.enabled ? `Regra salva: ${chat.amount} ${currencyLabel}, com intervalo de ${formatDuration(chat.cooldownSeconds)} por pessoa. Envie uma mensagem real e confira o crédito; salvar a regra não instala a action.` : "Defina a quantidade e o intervalo entre ganhos, ative a regra e configure a action de chat no Streamer.bot.", href: section("economia"), link: "Configurar ganhos no chat" },
    { id: "catalog", title: "Itens para resgatar", state: !redemptions || !catalog ? "blocked" : catalog.available ? "configured" : "pending", detail: !redemptions ? blocked : !catalog ? "Não foi possível consultar seus itens." : `${catalog.total} item(ns) cadastrado(s); ${catalog.available} ativo(s) com estoque disponível. O ID ou nome da action precisa corresponder ao seu Streamer.bot.`, ...(redemptions ? { href: section("resgates"), link: "Configurar e testar resgates" } : {}) },
    { id: "bridge", title: "Bridge e ações locais", state: "verify", detail: "Confirme no seu computador que o bridge está em execução e que cada action funciona. Ainda não há uma verificação automática de presença do bridge." },
    { id: "test", title: "Primeiro resgate", state: catalog?.completed && redemptions ? "configured" : "verify", detail: catalog?.completed && redemptions ? `${catalog.completed} resgate(s) com conclusão registrada. Confira também o efeito na transmissão; o registro não comprova o resultado visual.` : "Com um espectador de teste, confira o vínculo do YouTube, ganhe moeda no chat, compre um item e observe o efeito na live. Confira débito e conclusão. Em resultado incerto, não repita a action." },
  ].map(step => !active ? { ...step, href: step.id === "credential" ? step.href : undefined, link: step.id === "credential" ? step.link : undefined } : step) as SetupStep[] };
}
