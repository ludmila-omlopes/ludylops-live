import { describe, expect, it } from "vitest";

import {
  describeModuleChoices,
  hasConfirmedModuleChoice,
  isSelfServiceModule,
  MODULE_CHOICE_KEYS,
  ModuleChoiceError,
  moduleChoiceClosure,
  moduleChoiceRequirements,
  moduleChoicesInputSchema,
  planModuleChoices,
} from "./module-choices";
import { DEFAULT_CREATOR_MODULES } from "./defaults";

const rows = (entries: Record<string, string>) => Object.entries(entries).map(([moduleKey, status]) => ({ moduleKey, status }));
const byKey = (choices: ReturnType<typeof describeModuleChoices>) => Object.fromEntries(choices.map((choice) => [choice.key, choice]));

describe("community module choices", () => {
  it("offers every module except OBS, Streamer.bot and what requires them", () => {
    expect(MODULE_CHOICE_KEYS).toEqual(["product_recommendations", "game_suggestions", "video_suggestions", "creator_suggestions", "bets", "points", "ranking"]);
    for (const key of MODULE_CHOICE_KEYS) {
      // Every requirement is choosable too, so a choice never pulls in the integration.
      for (const dependency of moduleChoiceRequirements(key)) expect(MODULE_CHOICE_KEYS).toContain(dependency);
      expect(moduleChoiceRequirements(key)).not.toEqual(expect.arrayContaining(["streamerbot"]));
    }
    expect(moduleChoiceRequirements("bets")).toEqual(["points"]);
    expect([...moduleChoiceClosure(["ranking", "bets"])].sort()).toEqual(["bets", "points", "ranking"]);
  });

  it("lets only page modules turn on alone", () => {
    expect(MODULE_CHOICE_KEYS.filter(isSelfServiceModule)).toEqual(["product_recommendations", "game_suggestions", "video_suggestions", "creator_suggestions"]);
    expect(moduleChoiceRequirements("game_suggestions")).toEqual([]);
    expect(moduleChoiceRequirements("video_suggestions")).toEqual([]);
    expect(moduleChoiceRequirements("creator_suggestions")).toEqual([]);
  });

  it("describes a new community: products off until chosen, the rest coming soon", () => {
    const choices = byKey(describeModuleChoices([]));
    expect(choices.product_recommendations).toMatchObject({ state: "off", chosen: false, editable: true });
    expect(choices.bets).toMatchObject({ state: "soon", chosen: false, editable: true, requires: ["points"] });
  });

  it("keeps platform installs, disabled and inconsistent rows out of the creator's hands", () => {
    const choices = byKey(describeModuleChoices([
      ...rows({ product_recommendations: "disabled", points: "installed", bets: "installed", creator_suggestions: "archived" }),
      ...rows({ ranking: "installed" }), ...rows({ ranking: "requested" }),
    ]));
    expect(choices.product_recommendations).toMatchObject({ state: "blocked", editable: false });
    expect(choices.points).toMatchObject({ state: "active", chosen: true, editable: false });
    // Installed for a live community, but bets still serve only Ludylops.
    expect(choices.bets).toMatchObject({ state: "soon", chosen: true, editable: false });
    expect(choices.creator_suggestions).toMatchObject({ state: "blocked", editable: false });
    expect(choices.ranking).toMatchObject({ state: "blocked", editable: false });
  });

  it("installs products, records the rest with their requirements and removes what was left out", () => {
    expect(planModuleChoices(rows({ product_recommendations: "installed", ranking: "requested" }), ["product_recommendations", "game_suggestions", "bets"])).toEqual({
      install: ["game_suggestions"], request: ["bets", "points"], remove: ["ranking"], keep: ["product_recommendations"],
    });
    expect(planModuleChoices(rows({ product_recommendations: "installed" }), [])).toEqual({ install: [], request: [], remove: ["product_recommendations"], keep: [] });
    expect(planModuleChoices([], ["product_recommendations"])).toEqual({ install: ["product_recommendations"], request: [], remove: [], keep: [] });
  });

  it("upgrades a requested module once it turns on alone", () => {
    expect(planModuleChoices(rows({ product_recommendations: "requested" }), ["product_recommendations"]).install).toEqual(["product_recommendations"]);
  });

  it("never changes what the platform installed, disabled or archived", () => {
    const platform = rows({ product_recommendations: "disabled", points: "installed", ranking: "installed", bets: "archived" });
    expect(planModuleChoices(platform, ["product_recommendations", "bets"])).toEqual({ install: [], request: [], remove: [], keep: [] });
    expect(planModuleChoices(platform, [])).toEqual({ install: [], request: [], remove: [], keep: [] });
    // The legacy seed is fully installed: only the self-service modules are the creator's to remove.
    expect(planModuleChoices(DEFAULT_CREATOR_MODULES, [])).toEqual({ install: [], request: [], remove: ["product_recommendations", "game_suggestions", "video_suggestions", "creator_suggestions"], keep: [] });
  });

  // No self-service module has requirements yet; these guard the next ones that will, such as bets.
  it("refuses to turn on a module before its requirements", () => {
    const betsAlone = (key: string) => key === "bets";
    expect(() => planModuleChoices([], ["bets"], betsAlone)).toThrow(
      new ModuleChoiceError("Para ativar Apostas, é preciso ativar antes: Moeda da comunidade."),
    );
    expect(planModuleChoices(rows({ points: "installed" }), ["bets"], betsAlone).install).toEqual(["bets"]);
  });

  it("refuses to remove a module an installed one still depends on", () => {
    const currencyAlone = (key: string) => key === "points";
    const installed = rows({ points: "installed", bets: "installed", ranking: "installed" });
    expect(() => planModuleChoices(installed, [], currencyAlone)).toThrow(
      new ModuleChoiceError("Apostas e Ranking dependem de Moeda da comunidade."),
    );
    expect(planModuleChoices(installed, ["ranking"], currencyAlone)).toEqual({ install: [], request: [], remove: [], keep: ["points"] });
  });

  it("counts only choices the creator saved", () => {
    expect(hasConfirmedModuleChoice([{ moduleKey: "product_recommendations", status: "installed", configJson: {} }])).toBe(false);
    expect(hasConfirmedModuleChoice([{ moduleKey: "product_recommendations", status: "installed", configJson: { chosenAt: "2026-10-03T12:00:00.000Z" } }])).toBe(true);
    expect(hasConfirmedModuleChoice([{ moduleKey: "bets", status: "requested", configJson: { chosenAt: "2026-10-03T12:00:00.000Z" } }])).toBe(true);
    expect(hasConfirmedModuleChoice([{ moduleKey: "product_recommendations", status: "disabled", configJson: { chosenAt: "2026-10-03T12:00:00.000Z" } }])).toBe(false);
    expect(hasConfirmedModuleChoice([{ moduleKey: "streamerbot", status: "installed", configJson: { chosenAt: "2026-10-03T12:00:00.000Z" } }])).toBe(false);
  });

  it.each([null, {}, { modules: "bets" }, { modules: ["obs_overlays"] }, { modules: ["streamerbot"] }, { modules: ["quotes"] }, { modules: [], creatorId: "other" }])(
    "rejects invalid or forged input %j",
    (input) => expect(moduleChoicesInputSchema.safeParse(input).success).toBe(false),
  );
});
