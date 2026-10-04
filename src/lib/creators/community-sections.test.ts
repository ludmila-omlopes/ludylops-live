import { describe, expect, it } from "vitest";

import { availableCommunitySections, isCommunitySectionAvailable } from "@/lib/creators/community-sections";
import { creatorModuleCatalog } from "@/lib/creators/modules";

const allInstalled = creatorModuleCatalog.map((module) => ({ moduleKey: module.key, status: "installed" }));

function tenant(status: string, modules = allInstalled) {
  return { creator: { id: "creator_1", status }, modules };
}

describe("community sections", () => {
  it("limits a page-only community to overview, identity, modules and products", () => {
    expect(availableCommunitySections(tenant("active", [{ moduleKey: "product_recommendations", status: "installed" }]), "canal").map(section => section.key))
      .toEqual(["overview", "identidade", "modulos", "produtos"]);
  });

  it("never opens a requested module's section", () => {
    expect(availableCommunitySections(tenant("active", [{ moduleKey: "product_recommendations", status: "requested" }]), "canal").map(section => section.key))
      .toEqual(["overview", "identidade", "modulos"]);
  });

  it.each(["disabled", "archived"])("hides integration when Streamer.bot is %s", (status) => {
    const modules = allInstalled.map(module => module.moduleKey === "streamerbot" ? { ...module, status } : module);
    expect(isCommunitySectionAvailable(tenant("active", modules), "integracao")).toBe(false);
  });

  it("lists every owner section in a fixed order when all modules are available", () => {
    expect(availableCommunitySections(tenant("active"), "canal").map((section) => [section.key, section.href])).toEqual([
      ["overview", "/comunidades/canal"],
      ["identidade", "/comunidades/canal/identidade"],
      ["modulos", "/comunidades/canal/modulos"],
      ["economia", "/comunidades/canal/economia"],
      ["resgates", "/comunidades/canal/resgates"],
      ["frases", "/comunidades/canal/frases"],
      ["produtos", "/comunidades/canal/produtos"],
      ["videos", "/comunidades/canal/videos"],
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
