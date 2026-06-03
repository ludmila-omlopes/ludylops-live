import { describe, expect, it } from "vitest";

import {
  findBestPsPlusCatalogMatch,
  normalizePsPlusGameName,
  parsePsPlusCatalogHtml,
} from "@/lib/playstation/ps-plus";

describe("PS Plus catalog helpers", () => {
  it("normalizes PlayStation Store edition and platform suffixes", () => {
    expect(normalizePsPlusGameName("Grand Theft Auto V (PS4™ e PS5™)")).toBe(
      "grand theft auto v",
    );
    expect(normalizePsPlusGameName("Hollow Knight Voidheart Edition")).toBe(
      "hollow knight voidheart edition",
    );
  });

  it("parses catalog tiles from PlayStation Store HTML", () => {
    const html = `
      <ul>
        <div data-qa="ems-sdk-grid#productTile0" data-qa-index="0">
          <a data-telemetry-meta="{&quot;id&quot;:&quot;UP0000-PPSA00000_00-GAME000000000000&quot;,&quot;titleId&quot;:&quot;PPSA00000_00&quot;,&quot;name&quot;:&quot;Celeste&quot;}" href="/pt-br/product/UP0000-PPSA00000_00-GAME000000000000">Celeste</a>
          <span>PS5</span><span>PS4</span><span>Extra</span>
        </div>
      </ul>
    `;

    expect(parsePsPlusCatalogHtml(html)).toEqual([
      {
        productId: "UP0000-PPSA00000_00-GAME000000000000",
        titleId: "PPSA00000_00",
        name: "Celeste",
        normalizedName: "celeste",
        productUrl:
          "https://store.playstation.com/pt-br/product/UP0000-PPSA00000_00-GAME000000000000",
        platforms: ["PS5", "PS4"],
        region: "pt-br",
        tier: "deluxe",
      },
    ]);
  });

  it("matches by stored product id before falling back to normalized name", () => {
    const catalog = [
      {
        productId: "product-1",
        titleId: "title-1",
        name: "Grand Theft Auto V (PS4™ e PS5™)",
        normalizedName: "grand theft auto v",
        productUrl: "https://store.playstation.com/pt-br/product/product-1",
        platforms: ["PS5", "PS4"],
        region: "pt-br",
        tier: "deluxe",
      },
      {
        productId: "product-2",
        titleId: null,
        name: "Celeste",
        normalizedName: "celeste",
        productUrl: "https://store.playstation.com/pt-br/product/product-2",
        platforms: ["PS4"],
        region: "pt-br",
        tier: "deluxe",
      },
    ];

    expect(
      findBestPsPlusCatalogMatch(
        {
          name: "Outro nome",
          psPlusProductId: "product-1",
        },
        catalog,
      )?.productId,
    ).toBe("product-1");

    expect(
      findBestPsPlusCatalogMatch(
        {
          name: "Grand Theft Auto V",
          platforms: ["PlayStation 5"],
        },
        catalog,
      )?.productId,
    ).toBe("product-1");
  });
});
