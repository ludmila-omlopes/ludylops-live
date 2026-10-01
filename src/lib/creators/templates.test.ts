import { describe, expect, it } from "vitest";

import { creatorTemplateFrom, creatorTemplateSchema, withCreatorTemplate } from "./templates";

describe("creator templates", () => {
  it("reads the stored template", () => {
    expect(creatorTemplateFrom({ template: "estudio" })).toBe("estudio");
    expect(creatorTemplateFrom({ template: "palco" })).toBe("palco");
    expect(creatorTemplateFrom({ template: "neobrutalista" })).toBe("neobrutalista");
  });

  it("keeps communities created before templates on the neobrutalist look", () => {
    expect(creatorTemplateFrom({})).toBe("neobrutalista");
    expect(creatorTemplateFrom(undefined)).toBe("neobrutalista");
    expect(creatorTemplateFrom({ template: "unknown" })).toBe("neobrutalista");
  });

  it("rejects unknown templates", () => {
    expect(creatorTemplateSchema.safeParse("glass").success).toBe(false);
  });

  it("stores the template without dropping other theme settings", () => {
    expect(withCreatorTemplate({ other: 1, template: "neobrutalista" }, "palco")).toEqual({ other: 1, template: "palco" });
  });
});
