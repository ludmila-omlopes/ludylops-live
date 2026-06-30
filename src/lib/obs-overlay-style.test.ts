import { describe, expect, it } from "vitest";

import {
  getObsOverlayStyle,
  getObsOverlayStyleFromSearchParamsRecord,
  normalizeObsOverlayStyle,
} from "@/lib/obs-overlay-style";

describe("getObsOverlayStyle", () => {
  it("does not force an override by default", () => {
    expect(getObsOverlayStyle(new URLSearchParams())).toBeNull();
  });

  it("enables the obscur style from the style parameter", () => {
    expect(getObsOverlayStyle(new URLSearchParams("style=obscur"))).toBe("obscur");
  });

  it("accepts minimal aliases for the second overlay style", () => {
    expect(getObsOverlayStyle(new URLSearchParams("style=minimal"))).toBe("obscur");
    expect(getObsOverlayStyle(new URLSearchParams("design=minimalista"))).toBe("obscur");
    expect(getObsOverlayStyle(new URLSearchParams("variant=clair-obscur"))).toBe("obscur");
  });

  it("ignores unknown values until it finds a valid override", () => {
    expect(getObsOverlayStyle(new URLSearchParams("style=unknown&theme=obscur"))).toBe("obscur");
  });

  it("normalizes the classic style explicitly", () => {
    expect(normalizeObsOverlayStyle("classic")).toBe("classic");
  });

  it("reads page search params records", () => {
    expect(getObsOverlayStyleFromSearchParamsRecord({ style: ["minimal"] })).toBe("obscur");
  });
});
