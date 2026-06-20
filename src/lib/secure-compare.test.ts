import { describe, expect, it } from "vitest";

import { timingSafeStringEqual } from "@/lib/secure-compare";

describe("timingSafeStringEqual", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeStringEqual("Bearer secret", "Bearer secret")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(timingSafeStringEqual("Bearer secret", "Bearer other")).toBe(false);
  });

  it("returns false for strings with different lengths", () => {
    expect(timingSafeStringEqual("", "Bearer secret")).toBe(false);
  });
});
