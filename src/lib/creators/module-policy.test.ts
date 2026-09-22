import { describe, expect, it } from "vitest";
import {
  creatorModuleCatalog as catalog,
  getEnabledModuleNav,
  type CreatorModuleManifest,
} from "./modules";
import { DEFAULT_CREATOR_MODULES } from "./defaults";
import {
  moduleAvailability,
  planModuleTransition,
  validateModuleCatalog,
} from "./module-policy";

const installed = () => structuredClone(DEFAULT_CREATOR_MODULES);
describe("module dependency policy", () => {
  it("accepts the complete legacy seed and its navigation", () => {
    expect(() => validateModuleCatalog(catalog)).not.toThrow();
    for (const manifest of catalog)
      expect(
        moduleAvailability(catalog, installed(), manifest.key).available,
      ).toBe(true);
    expect(getEnabledModuleNav(installed()).map((item) => item.href)).toContain(
      "/quotes",
    );
  });
  it.each(["disabled", "archived", "missing", "unknown"])(
    "rejects a %s transitive requirement without hiding independent resources",
    (status) => {
      const rows = installed().filter((row) => row.moduleKey !== "streamerbot");
      if (status !== "missing")
        rows.push({
          ...installed()[0],
          moduleKey: "streamerbot",
          status: status as "disabled",
        });
      expect(moduleAvailability(catalog, rows, "quotes")).toEqual({
        available: false,
        missing: ["streamerbot"],
      });
      expect(
        moduleAvailability(catalog, rows, "product_recommendations").available,
      ).toBe(true);
      expect(getEnabledModuleNav(rows).map((item) => item.href)).not.toContain(
        "/quotes",
      );
    },
  );
  it("rejects duplicates, unknown modules and cycles", () => {
    expect(
      moduleAvailability(
        catalog,
        [...installed(), installed()[0]],
        installed()[0].moduleKey,
      ).available,
    ).toBe(false);
    expect(moduleAvailability(catalog, installed(), "unknown").available).toBe(
      false,
    );
    expect(() => validateModuleCatalog([...catalog, catalog[0]])).toThrow(
      "duplicate_module",
    );
    const bad = [
      { ...catalog[0], requiredCapabilities: ["not_a_module"] },
    ] as unknown as CreatorModuleManifest[];
    expect(() => validateModuleCatalog(bad)).toThrow(
      "unknown_module_dependency",
    );
    const cycle = [{ ...catalog[0], requiredCapabilities: [catalog[0].key] }];
    expect(() => validateModuleCatalog(cycle)).toThrow(
      "module_dependency_cycle",
    );
    expect(
      moduleAvailability(cycle, installed(), catalog[0].key).available,
    ).toBe(false);
  });
  it("reports all missing requirements and preserves the input when enabling is rejected", () => {
    const rows = installed().filter(
      (row) =>
        !["points", "obs_overlays", "streamerbot"].includes(row.moduleKey),
    );
    const before = structuredClone(rows);
    expect(
      planModuleTransition(catalog, rows, "quotes", "installed"),
    ).toMatchObject({
      allowed: false,
      blocking: expect.arrayContaining([
        "points",
        "obs_overlays",
        "streamerbot",
      ]),
    });
    expect(rows).toEqual(before);
  });
  it.each(["disabled", "archived"])(
    "blocks %s with transitive installed dependents, even already-broken ones",
    (status) => {
      const rows = installed().filter(
        (row) => row.moduleKey !== "obs_overlays",
      );
      const plan = planModuleTransition(catalog, rows, "streamerbot", status);
      expect(plan.allowed).toBe(false);
      expect(plan.blocking).toEqual(
        expect.arrayContaining(["quotes", "redemptions", "bets"]),
      );
    },
  );
  it("permits leaf removal and ordered dependency repair", () => {
    expect(
      planModuleTransition(catalog, installed(), "quotes", "disabled").allowed,
    ).toBe(true);
    const rows: { moduleKey: string; status: string }[] = [];
    for (const key of ["points", "streamerbot", "obs_overlays", "quotes"]) {
      expect(
        planModuleTransition(catalog, rows, key, "installed").allowed,
      ).toBe(true);
      rows.push({ moduleKey: key, status: "installed" });
    }
    expect(moduleAvailability(catalog, rows, "quotes").available).toBe(true);
  });
});
