import { describe, expect, it } from "vitest";

import { formatCreateBetSchemaError, validateCreateBetDraft } from "@/lib/bets/admin";
import { createBetSchema } from "@/lib/streamerbot/schemas";

describe("validateCreateBetDraft", () => {
  it("rejects questions shorter than the admin UI allows", () => {
    expect(
      validateCreateBetDraft({
        question: "Boss?",
        closesAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        options: ["Sim", "Nao"],
      }),
    ).toBe("A pergunta precisa ter ao menos 6 caracteres.");
  });

  it("rejects more than six options", () => {
    expect(
      validateCreateBetDraft({
        question: "Ela vence esse boss hoje?",
        closesAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        options: ["1", "2", "3", "4", "5", "6", "7"],
      }),
    ).toBe("A aposta pode ter no máximo 6 opções.");
  });

  it("rejects closing dates in the past", () => {
    expect(
      validateCreateBetDraft({
        question: "Ela vence esse boss hoje?",
        closesAt: new Date(Date.now() - 60 * 1000).toISOString(),
        options: ["Sim", "Nao"],
      }),
    ).toBe("Escolha um horário futuro para encerrar a aposta.");
  });
});

describe("formatCreateBetSchemaError", () => {
  it("maps schema errors to admin-friendly messages", () => {
    const parsed = createBetSchema.safeParse({
      question: "abc",
      closesAt: "not-a-date",
      options: ["Sim"],
      startOpen: true,
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected invalid payload.");
    }

    expect(formatCreateBetSchemaError(parsed.error)).toBe(
      "A pergunta precisa ter ao menos 6 caracteres.",
    );
  });
});
