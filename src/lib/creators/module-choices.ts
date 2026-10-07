import { z } from "zod";

import { moduleAvailability } from "./module-policy";
import { creatorModuleCatalog, getCreatorModuleManifest, pageModuleKeys, type CreatorModuleKey } from "./modules";

// What a creator picks for their own community. Client-safe: the Módulos
// section and the setup checklist both import it. OBS, Streamer.bot and every
// module that requires them stay with the platform console.
export const MODULE_CHOICE_KEYS = [
  "product_recommendations",
  "game_suggestions",
  "video_suggestions",
  "creator_suggestions",
  "bets",
  "points",
  "ranking",
] as const satisfies readonly CreatorModuleKey[];
export type ModuleChoiceKey = (typeof MODULE_CHOICE_KEYS)[number];

export const moduleChoiceOptions: Record<ModuleChoiceKey, { label: string; description: string }> = {
  product_recommendations: {
    label: "Produtos indicados",
    description: "Suas indicações de setup, jogos e dia a dia, com o link da loja ou o seu link de afiliado.",
  },
  game_suggestions: {
    label: "Sugestões de jogos",
    description: "Seu público sugere jogos para você jogar e apoia os favoritos.",
  },
  video_suggestions: {
    label: "Vídeos para reagir",
    description: "Seu público manda vídeos para você assistir e reagir.",
  },
  creator_suggestions: {
    label: "Inspirações",
    description: "Seu público indica outros criadores para você conhecer.",
  },
  bets: {
    label: "Apostas",
    description: "Seu público aposta a moeda da comunidade nos palpites que você abrir.",
  },
  points: {
    label: "Moeda da comunidade",
    description: "Seu público acumula uma moeda própria, com o nome que você escolher.",
  },
  ranking: {
    label: "Ranking",
    description: "Quem mais acumulou a moeda da comunidade, em destaque.",
  },
};

/** Modules that already serve communities other than Ludylops once installed. */
const communityReadyKeys: readonly ModuleChoiceKey[] = ["product_recommendations", "game_suggestions", "video_suggestions", "creator_suggestions", "points", "ranking"];

/** The creator turns these on alone, right away. Choosing any other one records it until its community version exists. */
export function isSelfServiceModule(key: string) {
  return pageModuleKeys.some((pageKey) => pageKey === key);
}

/** Moeda and Ranking only turn on alone where the community economy is switched on. */
const economyModuleKeys: readonly ModuleChoiceKey[] = ["points", "ranking"];
export function turnsOnAloneWith(economyEnabled: boolean) {
  return (key: ModuleChoiceKey) => isSelfServiceModule(key) && (economyEnabled || !economyModuleKeys.includes(key));
}

/** The currency keeps balances, its name and earning rules; once on, only the platform turns it off. */
const keptOnceInstalled: readonly ModuleChoiceKey[] = ["points"];

export const moduleChoicesInputSchema = z
  .object({
    modules: z.array(z.enum(MODULE_CHOICE_KEYS, { message: "Escolha módulos válidos." })).max(MODULE_CHOICE_KEYS.length),
  })
  .strict();

function requirementsOf(key: CreatorModuleKey, found = new Set<CreatorModuleKey>()) {
  for (const dependency of getCreatorModuleManifest(key)?.requiredCapabilities ?? []) {
    if (!found.has(dependency)) {
      found.add(dependency);
      requirementsOf(dependency, found);
    }
  }
  return found;
}

/** Every module a choice brings along, in catalog order. */
export function moduleChoiceRequirements(key: ModuleChoiceKey) {
  const found = requirementsOf(key);
  return MODULE_CHOICE_KEYS.filter((candidate) => found.has(candidate));
}

/** The chosen modules plus everything they require. */
export function moduleChoiceClosure(keys: Iterable<ModuleChoiceKey>) {
  const closure = new Set<ModuleChoiceKey>();
  for (const key of keys) {
    closure.add(key);
    moduleChoiceRequirements(key).forEach((dependency) => closure.add(dependency));
  }
  return closure;
}

export type ModuleChoiceState =
  /** Installed and serving the community. */
  | "active"
  /** Chosen or available to choose, waiting for its community version. */
  | "soon"
  /** Turned on by the creator alone; currently off. */
  | "off"
  /** Disabled or archived by the platform; only the platform turns it back on. */
  | "blocked";

export type ModuleChoice = {
  key: ModuleChoiceKey;
  label: string;
  description: string;
  state: ModuleChoiceState;
  chosen: boolean;
  /** False when only the platform can change it. */
  editable: boolean;
  requires: ModuleChoiceKey[];
};

type ModuleRow = { moduleKey: string; status: string; configJson?: unknown };

function rowStatus(rows: readonly ModuleRow[], key: string) {
  const matches = rows.filter((row) => row.moduleKey === key);
  if (matches.length > 1) return "inconsistent";
  return matches[0]?.status ?? "missing";
}

export function describeModuleChoices(rows: readonly ModuleRow[], turnsOnAlone: (key: ModuleChoiceKey) => boolean = isSelfServiceModule): ModuleChoice[] {
  return MODULE_CHOICE_KEYS.map((key): ModuleChoice => {
    const status = rowStatus(rows, key);
    const selfService = turnsOnAlone(key);
    const base = { key, ...moduleChoiceOptions[key], requires: moduleChoiceRequirements(key) };
    if (status === "installed") {
      return { ...base, state: communityReadyKeys.includes(key) ? "active" : "soon", chosen: true, editable: selfService && !keptOnceInstalled.includes(key) };
    }
    if (status === "requested") return { ...base, state: "soon", chosen: true, editable: true };
    if (status === "missing") return { ...base, state: selfService ? "off" : "soon", chosen: false, editable: true };
    return { ...base, state: "blocked", chosen: false, editable: false };
  });
}

/** True once the creator saved a choice that is still in place; platform installs do not count. */
export function hasConfirmedModuleChoice(rows: readonly ModuleRow[]) {
  return rows.some((row) => {
    const config = row.configJson as Record<string, unknown> | null | undefined;
    return (
      MODULE_CHOICE_KEYS.some((key) => key === row.moduleKey) &&
      (row.status === "installed" || row.status === "requested") &&
      typeof config?.chosenAt === "string"
    );
  });
}

export class ModuleChoiceError extends Error {}

export type ModuleChoicePlan = {
  install: ModuleChoiceKey[];
  request: ModuleChoiceKey[];
  remove: ModuleChoiceKey[];
  /** Creator-controlled rows that stay as they are. */
  keep: ModuleChoiceKey[];
};

const listFormat = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });
export const joinModuleLabels = (keys: readonly string[]) =>
  listFormat.format(keys.map((key) => moduleChoiceOptions[key as ModuleChoiceKey]?.label ?? getCreatorModuleManifest(key)?.label ?? key));

/**
 * Turns the creator's choice into row changes. Platform installs, disabled,
 * archived and inconsistent rows are never touched.
 */
export function planModuleChoices(
  rows: readonly ModuleRow[],
  chosen: readonly ModuleChoiceKey[],
  turnsOnAlone: (key: ModuleChoiceKey) => boolean = isSelfServiceModule,
): ModuleChoicePlan {
  const wanted = moduleChoiceClosure(chosen);
  const plan: ModuleChoicePlan = { install: [], request: [], remove: [], keep: [] };

  for (const key of MODULE_CHOICE_KEYS) {
    const status = rowStatus(rows, key);
    const selfService = turnsOnAlone(key);
    if (status === "missing") {
      if (wanted.has(key)) plan[selfService ? "install" : "request"].push(key);
    } else if (status === "requested") {
      if (!wanted.has(key)) plan.remove.push(key);
      else plan[selfService ? "install" : "keep"].push(key);
    } else if (status === "installed" && selfService && !keptOnceInstalled.includes(key)) {
      plan[wanted.has(key) ? "keep" : "remove"].push(key);
    }
  }

  const changed = new Set<string>([...plan.install, ...plan.request, ...plan.remove]);
  const next = [
    ...rows.filter((row) => !changed.has(row.moduleKey)),
    ...plan.install.map((moduleKey) => ({ moduleKey, status: "installed" })),
    ...plan.request.map((moduleKey) => ({ moduleKey, status: "requested" })),
  ];
  for (const key of plan.install) {
    const { missing } = moduleAvailability(creatorModuleCatalog, next, key);
    if (missing.length) {
      throw new ModuleChoiceError(`Para ativar ${moduleChoiceOptions[key].label}, é preciso ativar antes: ${joinModuleLabels(missing)}.`);
    }
  }
  for (const key of plan.remove) {
    const dependents = next
      .filter((row) => row.status === "installed" && requirementsOf(row.moduleKey as CreatorModuleKey).has(key))
      .map((row) => row.moduleKey);
    if (dependents.length) {
      throw new ModuleChoiceError(`${joinModuleLabels(dependents)} ${dependents.length > 1 ? "dependem" : "depende"} de ${moduleChoiceOptions[key].label}.`);
    }
  }
  return plan;
}
