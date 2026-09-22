import type { CreatorModuleManifest } from "./modules";

type ModuleState = { moduleKey: string; status: string };
export function validateModuleCatalog(
  catalog: readonly CreatorModuleManifest[],
) {
  const keys = new Set(catalog.map((module) => module.key));
  if (keys.size !== catalog.length) throw new Error("duplicate_module");
  const visit = (key: string, path: string[]) => {
    if (path.includes(key)) throw new Error("module_dependency_cycle");
    const manifest = catalog.find((entry) => entry.key === key);
    if (!manifest) throw new Error(`unknown_module_dependency:${key}`);
    manifest.requiredCapabilities.forEach((dependency) =>
      visit(dependency, [...path, key]),
    );
  };
  keys.forEach((key) => visit(key, []));
}

export function moduleAvailability(
  catalog: readonly CreatorModuleManifest[],
  rows: readonly ModuleState[],
  key: string,
): { available: boolean; missing: string[] } {
  const missing = new Set<string>();
  const visit = (key: string, path: string[]) => {
    const manifest = catalog.find((entry) => entry.key === key);
    if (!manifest || path.includes(key)) {
      missing.add(key);
      return;
    }
    // Duplicate/unknown states fail closed too.
    const matches = rows.filter((row) => row.moduleKey === key);
    if (matches.length !== 1 || matches[0].status !== "installed")
      missing.add(key);
    manifest.requiredCapabilities.forEach((dependency) =>
      visit(dependency, [...path, key]),
    );
  };
  visit(key, []);
  return { available: missing.size === 0, missing: [...missing] };
}

export function planModuleTransition(
  catalog: readonly CreatorModuleManifest[],
  rows: readonly ModuleState[],
  key: string,
  status: string,
) {
  validateModuleCatalog(catalog);
  const manifest = catalog.find((entry) => entry.key === key);
  if (!manifest || !["installed", "disabled", "archived"].includes(status))
    throw new Error("invalid_module_transition");
  const next = [
    ...rows.filter((row) => row.moduleKey !== key),
    { moduleKey: key, status },
  ];
  const dependsOn = (candidate: string): boolean => {
    const dependencies =
      catalog.find((entry) => entry.key === candidate)?.requiredCapabilities ??
      [];
    return dependencies.some(
      (dependency) => dependency === key || dependsOn(dependency),
    );
  };
  const blocking =
    status === "installed"
      ? moduleAvailability(catalog, next, key).missing
      : rows
          .filter(
            (row) =>
              row.status === "installed" &&
              row.moduleKey !== key &&
              dependsOn(row.moduleKey),
          )
          .map((row) => row.moduleKey);
  return {
    allowed: blocking.length === 0,
    kind:
      status === "installed" ? "missing_dependencies" : "installed_dependents",
    blocking,
    moduleKey: key,
    status,
  };
}
