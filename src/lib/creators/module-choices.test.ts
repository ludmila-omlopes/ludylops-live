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
  turnsOnAloneWith,
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
    expect(MODULE_CHOICE_KEYS.filter(isSelfServiceModule)).toEqual(["product_recommendations", "game_suggestions", "video_suggestions", "creator_suggestions", "bets", "points", "ranking"]);
    // Without the community economy switched on, the currency, the ranking and bets wait.
    expect(MODULE_CHOICE_KEYS.filter(turnsOnAloneWith(false))).toEqual(["product_recommendations", "game_suggestions", "video_suggestions", "creator_suggestions"]);
    expect(moduleChoiceRequirements("game_suggestions")).toEqual([]);
    expect(moduleChoiceRequirements("video_suggestions")).toEqual([]);
    expect(moduleChoiceRequirements("creator_suggestions")).toEqual([]);
  });

  it("describes a new community: everything off until chosen, the economy modules waiting for the switch", () => {
    const choices = byKey(describeModuleChoices([]));
    expect(choices.product_recommendations).toMatchObject({ state: "off", chosen: false, editable: true });
    expect(choices.bets).toMatchObject({ state: "off", chosen: false, editable: true, requires: ["points"] });
    expect(byKey(describeModuleChoices([], turnsOnAloneWith(false))).bets).toMatchObject({ state: "soon", chosen: false, editable: true });
  });

  it("keeps platform installs, disabled and inconsistent rows out of the creator's hands", () => {
    const choices = byKey(describeModuleChoices([
      ...rows({ product_recommendations: "disabled", points: "installed", bets: "installed", creator_suggestions: "archived" }),
      ...rows({ ranking: "installed" }), ...rows({ ranking: "requested" }),
    ]));
    expect(choices.product_recommendations).toMatchObject({ state: "blocked", editable: false });
    expect(choices.points).toMatchObject({ state: "active", chosen: true, editable: false });
    // Bets run on the page, so the creator can turn them off again; without the economy switch only the platform can.
    expect(choices.bets).toMatchObject({ state: "active", chosen: true, editable: true });
    expect(byKey(describeModuleChoices(rows({ points: "installed", bets: "installed" }), turnsOnAloneWith(false))).bets).toMatchObject({ state: "active", editable: false });
    expect(choices.creator_suggestions).toMatchObject({ state: "blocked", editable: false });
    expect(choices.ranking).toMatchObject({ state: "blocked", editable: false });
  });

  it("installs products, records the rest with their requirements and removes what was left out", () => {
    const current = rows({ product_recommendations: "installed", ranking: "requested" });
    expect(planModuleChoices(current, ["product_recommendations", "game_suggestions", "bets"], turnsOnAloneWith(false))).toEqual({
      install: ["game_suggestions"], request: ["bets", "points"], remove: ["ranking"], keep: ["product_recommendations"],
    });
    // With the economy on, bets and the currency they need turn on right away.
    expect(planModuleChoices(current, ["product_recommendations", "game_suggestions", "bets"], turnsOnAloneWith(true))).toEqual({
      install: ["game_suggestions", "bets", "points"], request: [], remove: ["ranking"], keep: ["product_recommendations"],
    });
    expect(planModuleChoices(rows({ product_recommendations: "installed" }), [])).toEqual({ install: [], request: [], remove: ["product_recommendations"], keep: [] });
    expect(planModuleChoices([], ["product_recommendations"])).toEqual({ install: ["product_recommendations"], request: [], remove: [], keep: [] });
  });

  it("upgrades a requested module once it turns on alone", () => {
    expect(planModuleChoices(rows({ product_recommendations: "requested" }), ["product_recommendations"]).install).toEqual(["product_recommendations"]);
  });

  it("never changes what the platform installed, disabled or archived", () => {
    const platform = rows({ product_recommendations: "disabled", points: "installed", ranking: "installed", bets: "archived" });
    expect(planModuleChoices(platform, ["product_recommendations", "bets"], turnsOnAloneWith(false))).toEqual({ install: [], request: [], remove: [], keep: [] });
    expect(planModuleChoices(platform, [], turnsOnAloneWith(false))).toEqual({ install: [], request: [], remove: [], keep: [] });
    // The legacy seed is fully installed: only the self-service modules are the creator's to remove.
    expect(planModuleChoices(DEFAULT_CREATOR_MODULES, [])).toEqual({ install: [], request: [], remove: ["product_recommendations", "game_suggestions", "video_suggestions", "creator_suggestions", "bets", "ranking"], keep: [] });
  });

  it("refuses to turn on a module before its requirements", () => {
    const betsAlone = (key: string) => key === "bets";
    expect(() => planModuleChoices([], ["bets"], betsAlone)).toThrow(
      new ModuleChoiceError("Para ativar Apostas, é preciso ativar antes: Moeda da comunidade."),
    );
    expect(planModuleChoices(rows({ points: "installed" }), ["bets"], betsAlone).install).toEqual(["bets"]);
  });

  it("keeps the currency once installed, even when unchecked", () => {
    const installed = rows({ points: "installed", bets: "installed", ranking: "installed" });
    expect(planModuleChoices(installed, [], turnsOnAloneWith(true))).toEqual({ install: [], request: [], remove: ["bets", "ranking"], keep: [] });
    expect(byKey(describeModuleChoices(installed, turnsOnAloneWith(true))).points).toMatchObject({ state: "active", chosen: true, editable: false });
    expect(new ModuleChoiceError("x")).toBeInstanceOf(Error);
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
