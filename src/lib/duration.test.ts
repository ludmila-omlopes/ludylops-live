import { describe, expect, it } from "vitest";

import { formatDuration, splitDuration, toSeconds } from "@/lib/duration";

describe("duration helpers", () => {
  it("picks the largest exact unit for editing", () => {
    expect(splitDuration(60)).toEqual({ value: 1, unit: "minutes" });
    expect(splitDuration(300)).toEqual({ value: 5, unit: "minutes" });
    expect(splitDuration(7200)).toEqual({ value: 2, unit: "hours" });
    expect(splitDuration(90)).toEqual({ value: 90, unit: "seconds" });
    expect(splitDuration(5400)).toEqual({ value: 90, unit: "minutes" });
    expect(splitDuration(0)).toEqual({ value: 0, unit: "seconds" });
  });

  it("converts back to whole seconds for the existing validation", () => {
    expect(toSeconds(5, "minutes")).toBe(300);
    expect(toSeconds(1.5, "hours")).toBe(5400);
    expect(toSeconds(10, "seconds")).toBe(10);
    expect(toSeconds(Number.NaN, "minutes")).toBeNaN();
  });

  it("formats readable labels", () => {
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(60)).toBe("1 min");
    expect(formatDuration(5400)).toBe("1 h 30 min");
    expect(formatDuration(86400)).toBe("24 h");
    expect(formatDuration(0)).toBe("0 s");
  });
});
