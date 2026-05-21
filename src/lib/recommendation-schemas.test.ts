import { describe, expect, it } from "vitest";

import {
  flattenProductRecommendationSchemaErrors,
  formatProductRecommendationSchemaError,
  productRecommendationSchema,
} from "@/lib/recommendation-schemas";

describe("productRecommendationSchema", () => {
  it("accepts a public image path with an absolute product link", () => {
    const parsed = productRecommendationSchema.safeParse({
      name: "Produto exemplo",
      category: "videogames",
      context: "Console fácil de indicar para quem acompanha a live.",
      imageUrl: "/uploads/produto-exemplo.jpg",
      href: "https://example.com/produto-exemplo",
      storeLabel: "Loja Teste",
      linkKind: "affiliate",
      sortOrder: 0,
      isActive: true,
    });

    expect(parsed.success).toBe(true);
  });

  it("returns friendly field errors for invalid form data", () => {
    const parsed = productRecommendationSchema.safeParse({
      name: "A",
      category: "videogames",
      context: "curto",
      imageUrl: "switch-oled.svg",
      href: "notaurl",
      storeLabel: "",
      linkKind: "external",
      sortOrder: -1,
      isActive: true,
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    expect(formatProductRecommendationSchemaError(parsed.error)).toBe(
      "Digite pelo menos 2 caracteres no nome.",
    );
    expect(flattenProductRecommendationSchemaErrors(parsed.error)).toMatchObject({
      name: "Digite pelo menos 2 caracteres no nome.",
      context: "Escreva um contexto com pelo menos 8 caracteres.",
      imageUrl: "Use uma URL válida ou um caminho local que comece com /.",
      href: "Digite uma URL válida com http ou https.",
      storeLabel: "Digite pelo menos 2 caracteres no nome da loja.",
      sortOrder: "A ordem deve ser zero ou maior.",
    });
  });
});
