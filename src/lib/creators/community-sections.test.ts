import { describe, expect, it } from "vitest";

import { availableCommunitySections, isCommunitySectionAvailable } from "@/lib/creators/community-sections";
import { creatorModuleCatalog } from "@/lib/creators/modules";

const allInstalled = creatorModuleCatalog.map((module) => ({ moduleKey: module.key, status: "installed" }));

function tenant(status: string, modules = allInstalled) {
  return { creator: { id: "creator_1", status }, modules };
}

describe("community sections", () => {
  it("lists every owner section in a fixed order when all modules are available", () => {
    expect(availableCommunitySections(tenant("active"), "canal").map((section) => [section.key, section.href])).toEqual([
      ["overview", "/comunidades/canal"],
      ["identidade", "/comunidades/canal/identidade"],
      ["economia", "/comunidades/canal/economia"],
      ["resgates", "/comunidades/canal/resgates"],
      ["frases", "/comunidades/canal/frases"],
      ["produtos", "/comunidades/canal/produtos"],
      ["mensagens", "/comunidades/canal/mensagens"],
      ["integracao", "/comunidades/canal/integracao"],
    ]);
  });

  it("keeps only the overview and credential revocation for inactive communities", () => {
    for (const status of ["disabled", "archived"]) {
      expect(availableCommunitySections(tenant(status), "canal").map((section) => section.key)).toEqual([
        "overview",
        "integracao",
      ]);
    }
  });

  it("hides sections whose module or dependency is unavailable", () => {
    const withoutRedemptions = allInstalled.map((module) =>
      module.moduleKey === "redemptions" ? { ...module, status: "disabled" } : module,
    );
    expect(isCommunitySectionAvailable(tenant("active", withoutRedemptions), "resgates")).toBe(false);

    const withoutPoints = allInstalled.map((module) =>
      module.moduleKey === "points" ? { ...module, status: "disabled" } : module,
    );
    expect(isCommunitySectionAvailable(tenant("active", withoutPoints), "economia")).toBe(false);
    expect(isCommunitySectionAvailable(tenant("active", withoutPoints), "resgates")).toBe(false);
    expect(isCommunitySectionAvailable(tenant("active", withoutPoints), "identidade")).toBe(true);
  });
});
