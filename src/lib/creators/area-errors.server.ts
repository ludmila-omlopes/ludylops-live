// Server-side classification only. The client form imports area-form.ts instead.
export type CreatorAreaErrorCode =
  | "invalid_creator_slug"
  | "creator_slug_reserved"
  | "missing_creator_owner"
  | "creator_schema_missing"
  | "creator_slug_exists"
  | "creator_area_unexpected";

export class CreatorAreaError extends Error {
  constructor(readonly code: CreatorAreaErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "CreatorAreaError";
  }
}

function errorCauses(error: unknown): Record<string, unknown>[] {
  const causes: Record<string, unknown>[] = [];
  const visited = new Set<unknown>();
  let current = error;
  while (current && typeof current === "object" && !visited.has(current) && causes.length < 16) {
    visited.add(current);
    const cause = current as Record<string, unknown>;
    causes.push(cause);
    current = cause.cause;
  }
  return causes;
}

export function isMissingCreatorSchemaError(error: unknown) {
  return errorCauses(error).some((cause) => cause.code === "42P01" || cause.code === "42703");
}

export function classifyCreatorAreaError(error: unknown): CreatorAreaError {
  if (error instanceof CreatorAreaError) {
    return error;
  }
  // Match the code and constraint on the SAME driver error, never query text.
  if (errorCauses(error).some((cause) => cause.code === "23505" && cause.constraint === "creators_slug_idx")) {
    return new CreatorAreaError("creator_slug_exists", { cause: error });
  }
  if (isMissingCreatorSchemaError(error)) {
    return new CreatorAreaError("creator_schema_missing", { cause: error });
  }
  return new CreatorAreaError("creator_area_unexpected", { cause: error });
}

export function creatorAreaErrorLogMetadata(error: unknown) {
  // Do not log the error object, message, stack, SQL, parameters or arbitrary
  // driver fields. Only these recognized diagnostics may leave the boundary.
  const codes = ["23505", "42P01", "42703", "23503", "42501", "40001", "40P01"];
  const driverError = errorCauses(error).find((cause) => codes.includes(String(cause.code)));
  return {
    code: error instanceof CreatorAreaError ? error.code : "creator_area_unexpected",
    databaseCode: driverError ? String(driverError.code) : undefined,
  };
}
