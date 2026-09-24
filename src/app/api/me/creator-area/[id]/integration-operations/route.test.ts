import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), origin: vi.fn(), get: vi.fn(), recover: vi.fn() }));
vi.mock("@/lib/api", () => ({ requireApiSession: mocks.auth, isTrustedAppMutationRequest: mocks.origin }));
vi.mock("@/lib/creators/redemptions.server", async original => ({ ...await original<typeof import("@/lib/creators/redemptions.server")>(), getCreatorOperations: mocks.get, recoverCreatorRedemption: mocks.recover }));
import { GET, POST } from "./route";
import { recoverySchema } from "@/lib/creators/integration-operations";
import { RedemptionAccessError, RedemptionConflictError } from "@/lib/creators/redemptions";
const context = { params: Promise.resolve({ id: "a" }) }, payload = { redemptionId: "r", outcome: "failed", expectedStatus: "executing", note: "Ação não executada", bridgeStopped: true, resultChecked: true };
const request = (body = payload) => new Request("https://example.com/api/me/creator-area/a/integration-operations", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { activeViewerId: "owner-a" } }); mocks.origin.mockReturnValue(true); mocks.get.mockResolvedValue({ pending: [] }); mocks.recover.mockImplementation(async (_id, _viewer, body) => recoverySchema.parse(body)); });
it("uses the authenticated owner and refuses anonymous or foreign-origin mutations", async () => {
  expect((await GET(request(), context)).headers.get("cache-control")).toBe("no-store"); expect(mocks.get).toHaveBeenCalledWith("a", "owner-a");
  expect((await POST(request(), context)).status).toBe(200); expect(mocks.recover).toHaveBeenCalledWith("a", "owner-a", payload);
  mocks.origin.mockReturnValue(false); expect((await POST(request(), context)).status).toBe(403);
  mocks.auth.mockResolvedValue(null); expect((await GET(request(), context)).status).toBe(401);
  mocks.origin.mockReturnValue(true); expect((await POST(request(), context)).status).toBe(401);
});
it("requires explicit observations and rejects identity fields", async () => {
  expect((await POST(request({ ...payload, bridgeStopped: false }), context)).status).toBe(400);
  expect((await POST(request({ ...payload, resultChecked: false }), context)).status).toBe(400);
  expect(recoverySchema.safeParse({ ...payload, viewerId: "other" }).success).toBe(false);
  expect(recoverySchema.safeParse({ ...payload, outcome: "retry" }).success).toBe(false);
});
it("sanitizes failures and reports conflicts", async () => {
  mocks.get.mockRejectedValue(new RedemptionAccessError()); expect((await GET(request(), context)).status).toBe(403);
  mocks.recover.mockRejectedValue(new RedemptionConflictError("Estado alterado.")); expect((await POST(request(), context)).status).toBe(409);
  mocks.get.mockRejectedValue(Error("private SQL")); const r = await GET(request(), context); expect(r.status).toBe(503); expect(await r.text()).not.toContain("private SQL");
});
