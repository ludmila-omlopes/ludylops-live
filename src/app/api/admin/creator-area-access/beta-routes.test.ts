import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), admin: vi.fn(), trusted: vi.fn(), submit: vi.fn(), get: vi.fn(), canCreate: vi.fn(), list: vi.fn(), review: vi.fn(), settings: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/api", () => ({
  requireApiSession: mocks.session, requireAdminApiSession: mocks.admin, isTrustedAppMutationRequest: mocks.trusted,
  ok: (data: unknown, init?: ResponseInit) => Response.json({ ok: true, data }, init),
  fail: (error: string, status = 400) => Response.json({ ok: false, error }, { status }),
}));
vi.mock("@/lib/creators/access", async (original) => ({ ...await original<typeof import("@/lib/creators/access")>(), submitCreatorBetaRequest: mocks.submit, getCreatorBetaRequest: mocks.get, canCreateCreatorArea: mocks.canCreate, listPendingCreatorBetaRequests: mocks.list, reviewCreatorBetaRequest: mocks.review, getCreatorAreaAccessSettings: mocks.settings, updateCreatorAreaAccessSettings: mocks.update }));

import { GET as getSelf, POST } from "@/app/api/me/creator-area-access/route";
import { GET as listRequests } from "./requests/route";
import { PATCH as review } from "./requests/[id]/route";
import { PATCH as update } from "./route";
import { CreatorBetaConflictError } from "@/lib/creators/access";

const id = `creator_beta_request:${"a".repeat(40)}`;
const params = { params: Promise.resolve({ id }) };
const request = (body: unknown, method = "PATCH") => new Request("http://localhost/api/test", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("beta request authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.trusted.mockReturnValue(true);
    mocks.session.mockResolvedValue({ user: { email: "viewer@example.com" } });
    mocks.admin.mockResolvedValue({ user: { email: "admin@example.com" } });
  });

  it("uses only the session email and keeps the self lookup private", async () => {
    mocks.submit.mockResolvedValue({ request: null, canCreate: false });
    expect((await POST(request({ email: "forged@example.com" }, "POST"))).status).toBe(200);
    expect(mocks.submit).toHaveBeenCalledWith("viewer@example.com");
    mocks.get.mockResolvedValue(null); mocks.canCreate.mockResolvedValue(false);
    const response = await getSelf();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.get).toHaveBeenCalledWith("viewer@example.com");
  });

  it("blocks unauthenticated and cross-origin submissions before touching storage", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request({}, "POST"))).status).toBe(401);
    expect((await getSelf()).status).toBe(401);
    mocks.trusted.mockReturnValue(false);
    expect((await POST(request({}, "POST"))).status).toBe(403);
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("requires admin access for listing and decisions and rejects cross-origin reviews", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await listRequests(new Request("http://localhost/api/test"))).status).toBe(403);
    expect((await review(request({ decision: "approved" }), params)).status).toBe(403);
    mocks.admin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.trusted.mockReturnValue(false);
    expect((await review(request({ decision: "approved" }), params)).status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.review).not.toHaveBeenCalled();
  });

  it("validates decisions and audits the authenticated admin", async () => {
    expect((await review(request({ decision: "maybe" }), params)).status).toBe(400);
    expect((await review(request({ decision: "approved", reviewedBy: "forged" }), params)).status).toBe(400);
    mocks.review.mockResolvedValue({});
    expect((await review(request({ decision: "approved" }), params)).status).toBe(200);
    expect(mocks.review).toHaveBeenCalledWith(id, "approved", "admin@example.com");
    mocks.review.mockRejectedValue(new CreatorBetaConflictError("Já analisado."));
    expect((await review(request({ decision: "rejected" }), params)).status).toBe(409);
  });

  it("requires a version for manual edits and does not leak storage errors", async () => {
    expect((await update(request({}))).status).toBe(400);
    expect((await update(request({ emailsText: "" }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
    mocks.update.mockRejectedValue(new Error("secret database connection"));
    const response = await update(request({ emailsText: "", expectedUpdatedAt: null }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
    mocks.submit.mockRejectedValue(new Error("secret"));
    expect((await POST(request({}, "POST"))).status).toBe(503);
  });
});
