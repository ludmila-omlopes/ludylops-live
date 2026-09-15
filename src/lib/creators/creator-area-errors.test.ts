import { describe, expect, it } from "vitest";

import { classifyCreatorAreaError, creatorAreaErrorLogMetadata, isMissingCreatorSchemaError } from "@/lib/creators/area-errors.server";
import { createCreatorAreaSchema, flattenCreatorAreaSchemaErrors, formatCreateCreatorAreaError } from "@/lib/creators/area-form";

describe("creator-area error boundary", () => {
  it("preserves field validation in the client-safe formatter", () => {
    const result = createCreatorAreaSchema.safeParse({ displayName: "", primaryColor: "red" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatCreateCreatorAreaError(result.error)).toBe("Informe o nome do criador.");
      expect(flattenCreatorAreaSchemaErrors(result.error)).toEqual({
        displayName: "Informe o nome do criador.",
        primaryColor: "Use uma cor em hexadecimal, como #c7a2e9.",
      });
    }
  });

  it.each([new Error("Failed query: insert into creators values ($1); params: secret"), "secret", null])(
    "never echoes an unknown error: %s", (error) => {
      expect(formatCreateCreatorAreaError(error)).toBe("Não foi possível criar sua área agora. Tente novamente mais tarde.");
    },
  );

  it("recognizes a wrapped driver slug constraint", () => {
    const driver = Object.assign(new Error("private driver detail"), { code: "23505", constraint: "creators_slug_idx" });
    const query = new Error("Failed query: secret", { cause: driver });
    const classified = classifyCreatorAreaError(query);
    expect(classified.code).toBe("creator_slug_exists");
    expect(classified.cause).toBe(query);
  });

  it.each([
    { code: "23505", constraint: "creator_domains_hostname_idx" },
    { code: "23503", constraint: "creators_slug_idx" },
    { code: "23505", cause: { constraint: "creators_slug_idx" } },
    new Error("23505 creators_slug_idx Failed query: creators"),
  ])("does not infer a slug conflict from unrelated or textual metadata", (error) => {
    expect(classifyCreatorAreaError(error).code).toBe("creator_area_unexpected");
    expect(isMissingCreatorSchemaError(error)).toBe(false);
  });

  it.each(["42P01", "42703"])("recognizes missing schema SQLSTATE %s", (code) => {
    expect(classifyCreatorAreaError(new Error("query", { cause: { code } })).code).toBe("creator_schema_missing");
  });

  it("terminates cyclic causes and logs only allowlisted metadata", () => {
    const error = Object.assign(new Error("secret SQL"), { code: "SECRET", constraint: "secret", cause: {} });
    error.cause = error;
    expect(classifyCreatorAreaError(error).code).toBe("creator_area_unexpected");
    expect(creatorAreaErrorLogMetadata(error)).toEqual({ code: "creator_area_unexpected", databaseCode: undefined });
    expect(creatorAreaErrorLogMetadata(classifyCreatorAreaError({ code: "42703", detail: "secret" }))).toEqual({
      code: "creator_schema_missing", databaseCode: "42703",
    });
  });
});
