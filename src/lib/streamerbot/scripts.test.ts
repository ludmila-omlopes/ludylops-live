import { describe, expect, it } from "vitest";

import {
  groupStreamerbotScripts,
  streamerbotScriptCategories,
} from "@/lib/streamerbot/scripts-catalog";
import { listStreamerbotScripts } from "@/lib/streamerbot/scripts.server";

describe("streamerbot scripts catalog", () => {
  it("loads every cataloged C# file from streamerbot/", () => {
    const scripts = listStreamerbotScripts();

    expect(scripts.length).toBeGreaterThanOrEqual(11);
    expect(scripts.every((script) => script.source.includes("public class CPHInline"))).toBe(true);
    expect(scripts.find((script) => script.id === "like-count-update")?.trigger).toContain(
      "Statistics Updated",
    );
  });

  it("groups scripts by category with Portuguese labels", () => {
    const grouped = groupStreamerbotScripts(listStreamerbotScripts());

    expect(grouped.some((entry) => entry.category === "live" && entry.label === "Live e recompensas")).toBe(
      true,
    );
    expect(grouped.every((entry) => entry.scripts.length > 0)).toBe(true);
    expect(Object.keys(streamerbotScriptCategories)).toHaveLength(6);
  });
});
