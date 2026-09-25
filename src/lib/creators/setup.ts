import { formatDuration } from "@/lib/duration";
import { getChatRewardSettings } from "./chat-rewards";
import { getCurrencyLabel } from "./currency";
import { modulesAreAvailable } from "./module-access";
import { communitySectionPath } from "./owner-dashboard";

export type SetupFacts = {
  creator: { id: string; slug: string; displayName: string; status: string };
  modules: { moduleKey: string; status: string; configJson: unknown }[];
  economyEnabled: boolean;
  credentials: { usable: number; lastUsedAt: string | null } | null;
  catalog: { total: number; available: number; completed: number } | null;
};
export type SetupStep = { id: string; title: string; state: "configured" | "pending" | "blocked" | "verify"; detail: string; href?: string; link?: string };
export type CreatorSetup = { displayName: string; active: boolean; currencyLabel: string; steps: SetupStep[] };
export function buildCreatorSetup(facts: SetupFacts): CreatorSetup {
  const { creator, modules, credentials, catalog } = facts;
  const active = creator.status === "active", points = modules.find(m => m.moduleKey === "points");
  const config = points?.configJson as Record<string, unknown> | undefined;
  const currencyLabel = getCurrencyLabel(config), chat = getChatRewardSettings(config);
  const economy = facts.economyEnabled && modulesAreAvailable(facts, ["points"]);
  const integration = modulesAreAvailable(facts, ["streamerbot"]);
  const redemptions = facts.economyEnabled && modulesAreAvailable(facts, ["redemptions"]);
  const section = (key: Parameters<typeof communitySectionPath>[1]) => communitySectionPath(creator.slug, key);
  const blocked = !active ? "Sua comunidade está desativada. Peça ajuda à administração para retomar." : !facts.economyEnabled ? "A moeda ainda aguarda liberação para uso. Peça ajuda à administração." : "Este recurso está desativado para sua comunidade. Peça ajuda à administração.";
  return { displayName: creator.displayName, active, currencyLabel, steps: [
    { id: "profile", title: "Nome e moeda", state: active ? "configured" : "blocked", detail: active ? `${creator.displayName} · ${currencyLabel}. Confira o nome e as cores que sua comunidade vai usar.` : blocked, href: section("identidade"), link: "Revisar nome e cores" },
    { id: "economy", title: "Moeda disponível", state: economy ? "configured" : "blocked", detail: economy ? `Saldo e movimentações em ${currencyLabel} estão disponíveis. Cada streamer mantém sua própria moeda.` : blocked, ...(economy ? { href: section("economia"), link: "Conferir moeda e ganhos" } : {}) },
    { id: "credential", title: "Credencial exclusiva", state: !integration || !credentials ? "blocked" : credentials.usable ? "configured" : "pending", detail: !integration ? blocked : !credentials ? "A emissão de credenciais não está disponível neste ambiente." : credentials.usable ? "Você tem uma credencial válida. Isso não confirma que o Streamer.bot esteja configurado." : "Crie uma credencial e salve o ID e o segredo no seu Streamer.bot.", href: section("integracao"), link: "Gerenciar credenciais" },
    { id: "authentication", title: "Autenticação recebida", state: integration && credentials?.lastUsedAt ? "configured" : "pending", detail: integration && credentials?.lastUsedAt ? `Última autenticação de uma credencial válida: ${credentials.lastUsedAt}. Ela não confirma conexão contínua nem execução de ações.` : "Execute check-credential.cs no seu Streamer.bot e confira o ID da sua comunidade no resultado. Depois atualize esta verificação." },
    { id: "chat", title: "Ganhos por mensagem", state: !economy || !integration ? "blocked" : chat.enabled ? "verify" : "pending", detail: !economy || !integration ? blocked : chat.enabled ? `Regra salva: ${chat.amount} ${currencyLabel}, com intervalo de ${formatDuration(chat.cooldownSeconds)} por pessoa. Envie uma mensagem real e confira o crédito; salvar a regra não instala a action.` : "Defina a quantidade e o intervalo entre ganhos, ative a regra e configure a action de chat no Streamer.bot.", href: section("economia"), link: "Configurar ganhos no chat" },
    { id: "catalog", title: "Itens para resgatar", state: !redemptions || !catalog ? "blocked" : catalog.available ? "configured" : "pending", detail: !redemptions ? blocked : !catalog ? "Não foi possível consultar seus itens." : `${catalog.total} item(ns) cadastrado(s); ${catalog.available} ativo(s) com estoque disponível. O ID ou nome da action precisa corresponder ao seu Streamer.bot.`, ...(redemptions ? { href: section("resgates"), link: "Configurar e testar resgates" } : {}) },
    { id: "bridge", title: "Bridge e ações locais", state: "verify", detail: "Confirme no seu computador que o bridge está em execução e que cada action funciona. Ainda não há uma verificação automática de presença do bridge." },
    { id: "test", title: "Primeiro resgate", state: catalog?.completed && redemptions ? "configured" : "verify", detail: catalog?.completed && redemptions ? `${catalog.completed} resgate(s) com conclusão registrada. Confira também o efeito na transmissão; o registro não comprova o resultado visual.` : "Com um espectador de teste, confira o vínculo do YouTube, ganhe moeda no chat, compre um item e observe o efeito na live. Confira débito e conclusão. Em resultado incerto, não repita a action." },
  ].map(step => !active ? { ...step, href: step.id === "credential" ? step.href : undefined, link: step.id === "credential" ? step.link : undefined } : step) as SetupStep[] };
}
