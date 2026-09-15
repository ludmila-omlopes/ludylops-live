import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, trustedMock, accessMock, createMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(), trustedMock: vi.fn(), accessMock: vi.fn(), createMock: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  fail: (message: string, status = 400) => Response.json({ ok: false, error: message }, { status }),
  ok: (data: unknown, init?: ResponseInit) => Response.json({ ok: true, data }, init),
  requireApiSession: sessionMock, isTrustedAppMutationRequest: trustedMock,
}));
vi.mock("@/lib/creators/access", () => ({ canCreateCreatorArea: accessMock }));
vi.mock("@/lib/creators/service", async () => {
  const form = await import("@/lib/creators/area-form");
  return { createCreatorArea: createMock, listCreatorAreasForOwner: vi.fn(), formatCreateCreatorAreaError: form.formatCreateCreatorAreaError };
});

import { POST } from "@/app/api/me/creator-area/route";
import { classifyCreatorAreaError, CreatorAreaError } from "@/lib/creators/area-errors.server";
import { createCreatorAreaSchema } from "@/lib/creators/area-form";

const genericError = "Não foi possível criar sua área agora. Tente novamente mais tarde.";
const sqlError = new Error("Failed query: insert into creators (owner_user_id) values ($1); params: PRIVATE_EMAIL_TOKEN", {
  cause: Object.assign(new Error("PRIVATE_PASSWORD"), { code: "23503", detail: "PRIVATE_PARAMS" }),
});
const invalidFields = createCreatorAreaSchema.safeParse({ displayName: "" });
if (invalidFields.success) throw new Error("Expected invalid fixture");
const zodError = invalidFields.error;

function request(body = JSON.stringify({ displayName: "Canal da Mari", slug: "canal-da-mari" })) {
  return new Request("https://example.test/api/me/creator-area", {
    method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body,
  });
}

describe("creator-area POST", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    trustedMock.mockReturnValue(true);
    sessionMock.mockResolvedValue({ user: { activeViewerId: "owner_1", email: "mari@example.test" } });
    accessMock.mockResolvedValue(true);
    createMock.mockResolvedValue({ creator: { id: "creator_1", slug: "canal-da-mari", ownerUserId: "owner_1" } });
  });

  it("returns the created area with201", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, data: { creator: { ownerUserId: "owner_1" } } });
    expect(createMock).toHaveBeenCalledWith("owner_1", { displayName: "Canal da Mari", slug: "canal-da-mari" });
  });

  it("rejects malformed JSON before creation", async () => {
    const response = await POST(request("{"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "Payload inválido." });
    expect(createMock).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    [zodError, 400, "Informe o nome do criador."],
    [new CreatorAreaError("invalid_creator_slug"), 400, "Use um endereço com letras, números e hífens."],
    [new CreatorAreaError("creator_slug_reserved"), 400, "Esse endereço é reservado."],
    [new CreatorAreaError("creator_slug_exists"), 409, "Esse endereço já está em uso."],
    [new CreatorAreaError("missing_creator_owner"), 401, "Entre novamente para criar a área."],
  ])("uses the expected status and public message for a known creation error", async (error, status, message) => {
    createMock.mockRejectedValue(error);
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ ok: false, error: message });
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    sqlError,
    classifyCreatorAreaError(sqlError),
    new SyntaxError("PRIVATE_SYNTAX_FROM_SERVICE"),
    new Error("creator_slug_exists"),
    classifyCreatorAreaError({ code: "23505", constraint: "other_unique_index" }),
    classifyCreatorAreaError({ code: "23505", cause: { constraint: "creators_slug_idx" } }),
    new CreatorAreaError("creator_schema_missing", { cause: { code: "42703", detail: "PRIVATE" } }),
  ])("returns a sanitized500 for server errors and logs safe diagnostics", async (error) => {
    createMock.mockRejectedValue(error);
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: genericError });
    expect(console.error).toHaveBeenCalledOnce();
    const log = vi.mocked(console.error).mock.calls[0];
    expect(log[0]).toBe("creator_area_creation_failed");
    expect(log[1]).toMatchObject({ stage: "creation" });
    expect(JSON.stringify(log)).not.toMatch(/PRIVATE|Failed query|owner_user_id|params|stack|mari@example/);
    expect(Object.keys(log[1])).toEqual(["stage", "code", "databaseCode"]);
  });

  it.each(["origin", "session", "access"])("preserves the %s authorization rejection", async (kind) => {
    if (kind === "origin") trustedMock.mockReturnValue(false);
    if (kind === "session") sessionMock.mockResolvedValue(null);
    if (kind === "access") accessMock.mockResolvedValue(false);
    const response = await POST(request());
    expect(response.status).toBe(kind === "session" ? 401 : 403);
    expect(createMock).not.toHaveBeenCalled();
  });

  it.each([sqlError, zodError, new SyntaxError("PRIVATE_AUTH"), new CreatorAreaError("creator_slug_exists")])(
    "contains unexpected authorization failures without classifying them as input errors", async (error) => {
      accessMock.mockRejectedValue(error);
      const response = await POST(request());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ ok: false, error: genericError });
      expect(createMock).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith("creator_area_creation_failed", expect.objectContaining({ stage: "authorization" }));
    },
  );

  it("contains unexpected session failures", async () => {
    sessionMock.mockRejectedValue(sqlError);
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: genericError });
    expect(accessMock).not.toHaveBeenCalled();
  });
});
