import { describe, expect, it } from "vitest";
import { buildCreatorSetup, type SetupFacts } from "./setup";
const facts: SetupFacts = { creator: { id: "a", slug: "canal-a", displayName: "Canal A", status: "active" }, economyEnabled: true,
  modules: ["points", "streamerbot", "redemptions"].map(moduleKey => ({ moduleKey, status: "installed", configJson: { currencyLabel: "cristais", chatRewards: { enabled: true, amount: 7, cooldownSeconds: 60 } } })),
  credentials: { usable: 1, lastUsedAt: null }, catalog: { total: 1, available: 0, completed: 0 } };
describe("creator setup evidence", () => {
  it("gives page-only communities a product checklist without live requirements", () => {
    const pageFacts = { ...facts, modules: [{ moduleKey: "product_recommendations", status: "installed", configJson: {} }], products: { published: 0 } };
    const setup = buildCreatorSetup(pageFacts);
    expect(setup.live).toBe(false);
    expect(setup.steps.map(step => [step.id, step.state])).toEqual([["profile", "configured"], ["products", "pending"], ["share", "verify"]]);
    expect(buildCreatorSetup({ ...pageFacts, products: { published: 2 } }).steps.find(step => step.id === "products")?.state).toBe("configured");
    for (const status of ["disabled", "archived"]) {
      const inactive = buildCreatorSetup({ ...pageFacts, creator: { ...facts.creator, status } });
      expect(inactive.steps.every(step => step.state === "blocked" && !step.href)).toBe(true);
    }
    expect(buildCreatorSetup({ ...pageFacts, products: null }).steps.find(step => step.id === "products")?.state).toBe("blocked");
  });

  it("switches the checklist with the installed live modules", () => {
    expect(buildCreatorSetup(facts).live).toBe(true);
    expect(buildCreatorSetup({ ...facts, modules: facts.modules.map(module => ({ ...module, status: "disabled" })) }).live).toBe(false);
    const withoutIntegration = buildCreatorSetup({ ...facts, modules: facts.modules.filter(module => module.moduleKey !== "streamerbot") });
    expect(withoutIntegration.steps.some(step => step.href?.endsWith("/integracao"))).toBe(false);
  });

  it("never treats issued credentials, saved rules or catalog entries as a working integration", () => {
    const steps = Object.fromEntries(buildCreatorSetup(facts).steps.map(s => [s.id, s]));
    expect(steps.credential.state).toBe("configured"); expect(steps.authentication.state).toBe("pending");
    expect(steps.chat.state).toBe("verify"); expect(steps.catalog.state).toBe("pending");
    expect(steps.bridge.state).toBe("verify"); expect(steps.test.state).toBe("verify");
    expect(steps.chat.detail).toContain("7 cristais");
  });
  it("links each step to the owner section that configures it", () => {
    const steps = Object.fromEntries(buildCreatorSetup(facts).steps.map(s => [s.id, s]));
    expect(steps.profile.href).toBe("/comunidades/canal-a/identidade");
    expect(steps.economy.href).toBe("/comunidades/canal-a/economia");
    expect(steps.credential.href).toBe("/comunidades/canal-a/integracao");
    expect(steps.chat.href).toBe("/comunidades/canal-a/economia");
    expect(steps.catalog.href).toBe("/comunidades/canal-a/resgates");
  });
  it("keeps economy and dependent routes unavailable until actually enabled", () => {
    const steps = buildCreatorSetup({ ...facts, economyEnabled: false }).steps;
    for (const id of ["economy", "chat", "catalog"]) expect(steps.find(s => s.id === id)?.state).toBe("blocked");
    expect(steps.some(s => s.href?.endsWith("/resgates"))).toBe(false);
  });
  it("checks module dependencies and lifecycle instead of trusting historical activity", () => {
    for (const disabled of ["points", "streamerbot", "redemptions"]) {
      const result = buildCreatorSetup({ ...facts, modules: facts.modules.map(m => ({ ...m, status: m.moduleKey === disabled ? "disabled" : m.status })), catalog: { total: 1, available: 1, completed: 1 } });
      expect(result.steps.find(s => s.id === "catalog")?.state).toBe("blocked");
      expect(result.steps.find(s => s.id === "test")?.state).toBe("verify");
    }
    const disabled = buildCreatorSetup({ ...facts, creator: { ...facts.creator, status: "archived" } });
    expect(disabled.active).toBe(false); expect(disabled.steps.filter(s => s.href).map(s => s.id)).toEqual(["credential"]);
  });
});
