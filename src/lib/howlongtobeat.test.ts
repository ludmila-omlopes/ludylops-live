import { afterEach, describe, expect, it, vi } from "vitest";

import { hltbAdapter } from "@/lib/hltb";
import { resolveHowLongToBeatGame } from "@/lib/howlongtobeat";

describe("hltbAdapter", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("discovers the current search endpoint and maps seconds to minutes", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url === "https://howlongtobeat.com") {
        return new Response('<script src="/_next/static/chunks/_app-demo.js"></script>');
      }

      if (url.endsWith("/_next/static/chunks/_app-demo.js")) {
        return new Response('const endpoint="/api/bleed"; const init="/api/bleed/init"; const searchTerms=true;');
      }

      if (url.includes("/api/bleed/init")) {
        return Response.json({
          token: "token-123",
          hpKey: "ign_test",
          hpVal: "guard-value",
        });
      }

      if (url.endsWith("/api/bleed")) {
        expect(init?.method).toBe("POST");
        expect((init?.headers as Record<string, string>)["x-auth-token"]).toBe("token-123");
        expect((init?.headers as Record<string, string>)["x-hp-key"]).toBe("ign_test");
        expect((init?.headers as Record<string, string>)["x-hp-val"]).toBe("guard-value");

        const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
        expect(payload.searchTerms).toEqual(["celeste"]);
        expect(payload.ign_test).toBe("guard-value");
        expect((payload.searchOptions as { games: { modifier: string } }).games.modifier).toBe("hide_dlc");

        return Response.json({
          data: [
            {
              game_id: 111,
              game_name: "Celeste DLC",
              comp_main: 1_000,
            },
            {
              game_id: 42818,
              game_name: "Celeste",
              game_alias: ["Celeste Classic"],
              profile_platform: ["PC", "Nintendo Switch"],
              comp_main: 29_921,
              comp_plus: 52_776,
              comp_100: 141_074,
            },
          ],
        });
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(hltbAdapter.searchBestMatch({ title: "Celeste", platformName: "PC" })).resolves.toMatchObject({
      hltbId: "42818",
      title: "Celeste",
      mainStoryMinutes: 499,
      mainExtraMinutes: 880,
      completionistMinutes: 2351,
      storeUrl: "https://howlongtobeat.com/game/42818",
      score: 100,
    });
  });

  it("rejects weak matches instead of enriching the wrong game", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url === "https://howlongtobeat.com") {
          return new Response('<script src="/search.js"></script>');
        }

        if (url.endsWith("/search.js")) {
          return new Response('const endpoint="/api/bleed"; const init="/api/bleed/init"; const searchTerms=true;');
        }

        if (url.includes("/api/bleed/init")) {
          return Response.json({ token: "token-123" });
        }

        if (url.endsWith("/api/bleed")) {
          return Response.json({
            data: [{ game_id: 1, game_name: "Hades", comp_main: 50_000 }],
          });
        }

        throw new Error(`Unexpected URL ${url}`);
      }),
    );

    await expect(hltbAdapter.searchBestMatch({ title: "Celeste" })).resolves.toBeNull();
  });

  it("returns null when discovery and fallback requests fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );

    await expect(hltbAdapter.searchBestMatch({ title: "Celeste" })).resolves.toBeNull();
  });
});

describe("resolveHowLongToBeatGame", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("keeps the existing repository-facing result shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url === "https://howlongtobeat.com") {
          return new Response('<script src="/search.js"></script>');
        }

        if (url.endsWith("/search.js")) {
          return new Response('const endpoint="/api/bleed"; const init="/api/bleed/init"; const searchTerms=true;');
        }

        if (url.includes("/api/bleed/init")) {
          return Response.json({ token: "token-123" });
        }

        if (url.endsWith("/api/bleed")) {
          return Response.json({
            data: [{ game_id: 42818, game_name: "Celeste", comp_main: 29_921 }],
          });
        }

        throw new Error(`Unexpected URL ${url}`);
      }),
    );

    await expect(resolveHowLongToBeatGame("Celeste")).resolves.toMatchObject({
      match: {
        id: "42818",
        name: "Celeste",
        mainStoryMinutes: 499,
        similarity: 1,
      },
    });
  });
});
