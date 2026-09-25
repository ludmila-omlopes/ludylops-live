import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/creators/tenant", async original => ({
  ...await original<typeof import("@/lib/creators/tenant")>(),
  resolvePublicCreatorFromRequest: async () => (await import("@/lib/creators/tenant")).defaultCreatorTenant,
}));

const requireAdminApiSessionMock = vi.hoisted(() => vi.fn());
const isTrustedAppMutationRequestMock = vi.hoisted(() => vi.fn());
const setStreamerbotLivestreamManualOverrideMock = vi.hoisted(() => vi.fn());
const clearStreamerbotLivestreamManualOverrideMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  fail: (message: string, status = 400) =>
    Response.json({ ok: false, error: message }, { status }),
  ok: (data: unknown, init?: ResponseInit) =>
    Response.json({ ok: true, data }, init),
  isTrustedAppMutationRequest: isTrustedAppMutationRequestMock,
  requireAdminApiSession: requireAdminApiSessionMock,
}));

vi.mock("@/lib/streamerbot/live-status", () => ({
  setStreamerbotLivestreamManualOverride: setStreamerbotLivestreamManualOverrideMock,
  clearStreamerbotLivestreamManualOverride: clearStreamerbotLivestreamManualOverrideMock,
}));

describe("admin live status route", () => {
  beforeEach(() => {
    isTrustedAppMutationRequestMock.mockReset();
    requireAdminApiSessionMock.mockReset();
    setStreamerbotLivestreamManualOverrideMock.mockReset();
    clearStreamerbotLivestreamManualOverrideMock.mockReset();

    isTrustedAppMutationRequestMock.mockReturnValue(true);
    requireAdminApiSessionMock.mockResolvedValue({
      user: {
        email: "admin@example.com",
      },
    });
  });

  it("returns the schema guidance when the manual override cannot be persisted", async () => {
    setStreamerbotLivestreamManualOverrideMock.mockRejectedValue(
      new Error("Schema dos contadores ainda não foi aplicado. Rode npm run db:push."),
    );

    const { POST } = await import("@/app/api/admin/live-status/route");
    const response = await POST(
      new Request("https://example.test/api/admin/live-status", {
        method: "POST",
        headers: {
          origin: "https://example.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "force_online",
          confirmationText: "ONLINE",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Schema dos contadores ainda não foi aplicado. Rode npm run db:push.",
    });
  });
});
