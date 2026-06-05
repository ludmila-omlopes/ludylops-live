import { afterEach, describe, expect, it, vi } from "vitest";

import {
  normalizeSteamGameName,
  parseSteamAppId,
  resolveSteamGamePrice,
} from "@/lib/steam/store";

describe("Steam store helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts app ids from Steam store links", () => {
    expect(parseSteamAppId("https://store.steampowered.com/app/504230/Celeste/")).toBe(504230);
    expect(parseSteamAppId("504230")).toBe(504230);
    expect(parseSteamAppId("https://example.com/jogo")).toBeNull();
  });

  it("normalizes edition suffixes for exact-name matching", () => {
    expect(normalizeSteamGameName("Hades II Deluxe Edition")).toBe("hades ii");
    expect(normalizeSteamGameName("Ação™ Complete Pack")).toBe("acao");
  });

  it("resolves price directly by app id", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          504230: {
            success: true,
            data: {
              name: "Celeste",
              is_free: false,
              price_overview: {
                currency: "BRL",
                initial: 3699,
                final: 924,
                discount_percent: 75,
              },
            },
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const resolution = await resolveSteamGamePrice({
      name: "Celeste",
      linkUrl: "https://store.steampowered.com/app/504230/Celeste/",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resolution.match).toMatchObject({
      appId: 504230,
      name: "Celeste",
      currency: "BRL",
      initialPriceCents: 3699,
      finalPriceCents: 924,
      discountPercent: 75,
      isFree: false,
      matchConfidence: "app_id",
    });
  });

  it("uses exact normalized store search before reading app details", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/api/storesearch")) {
        return new Response(
          JSON.stringify({
            items: [
              { id: 1, name: "Celeste Soundtrack" },
              { id: 504230, name: "Celeste" },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({
          504230: {
            success: true,
            data: {
              name: "Celeste",
              is_free: false,
              price_overview: {
                currency: "BRL",
                initial: 3699,
                final: 3699,
                discount_percent: 0,
              },
            },
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const resolution = await resolveSteamGamePrice({ name: "Celeste" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(resolution.match?.appId).toBe(504230);
    expect(resolution.match?.matchConfidence).toBe("exact_name");
  });

  it("does not match fuzzy search results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            items: [{ id: 1, name: "Celeste Soundtrack" }],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(resolveSteamGamePrice({ name: "Celeste" })).resolves.toMatchObject({
      match: null,
    });
  });
});
