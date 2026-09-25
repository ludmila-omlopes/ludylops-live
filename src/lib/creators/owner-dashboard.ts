import type { CreatorSetup } from "./setup";
import type { CreatorStatus } from "@/lib/types";

export type OwnedCommunity = {
  id: string;
  slug: string;
  displayName: string;
  status: CreatorStatus;
  publicUrl: string;
  isLegacy: boolean;
  primaryColor: string;
  accentColor: string;
};

export type SetupProgress = {
  configured: number;
  total: number;
  authenticated: boolean;
};

export type OwnedCommunityCard = OwnedCommunity & {
  currencyLabel: string | null;
  setup: SetupProgress | null;
};

export const COMMUNITIES_PATH = "/comunidades";
export const NEW_COMMUNITY_PATH = "/comunidades/nova";

export function communityDashboardPath(slug: string) {
  return `${COMMUNITIES_PATH}/${encodeURIComponent(slug)}`;
}

export type CommunitySectionKey =
  | "overview"
  | "identidade"
  | "economia"
  | "resgates"
  | "frases"
  | "produtos"
  | "mensagens"
  | "integracao";

export const communitySectionLabels: Record<CommunitySectionKey, string> = {
  overview: "Visão geral",
  identidade: "Identidade",
  economia: "Economia",
  resgates: "Resgates",
  frases: "Frases",
  produtos: "Produtos",
  mensagens: "Mensagens no chat",
  integracao: "Integração",
};

export function communitySectionPath(slug: string, section: CommunitySectionKey) {
  const base = communityDashboardPath(slug);
  return section === "overview" ? base : `${base}/${section}`;
}

export const creatorStatusLabels: Record<CreatorStatus, string> = {
  active: "Ativa",
  disabled: "Desativada",
  archived: "Arquivada",
};

export function summarizeSetup(setup: Pick<CreatorSetup, "steps">): SetupProgress {
  return {
    configured: setup.steps.filter((step) => step.state === "configured").length,
    total: setup.steps.length,
    authenticated: setup.steps.some((step) => step.id === "authentication" && step.state === "configured"),
  };
}

const statusOrder: Record<CreatorStatus, number> = { active: 0, disabled: 1, archived: 2 };

/** Active communities first, then disabled, then archived; alphabetical inside each group. */
export function sortOwnedCommunities<T extends Pick<OwnedCommunity, "status" | "displayName">>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      a.displayName.localeCompare(b.displayName, "pt-BR", { sensitivity: "base" }),
  );
}
