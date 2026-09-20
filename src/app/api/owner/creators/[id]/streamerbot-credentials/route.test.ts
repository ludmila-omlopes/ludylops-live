import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), trusted: vi.fn(), issue: vi.fn(), list: vi.fn(), revoke: vi.fn() }));
vi.mock("@/lib/api", () => ({ requirePlatformOwnerApiSession: mocks.session, isTrustedAppMutationRequest: mocks.trusted }));
vi.mock("@/lib/streamerbot/credentials", () => ({
  issueStreamerbotCredential: mocks.issue, listStreamerbotCredentials: mocks.list, revokeStreamerbotCredential: mocks.revoke,
  CredentialOperationError: class extends Error { constructor(public status: number, message: string) { super(message); } },
}));
import { GET, POST } from "./route";
const id = `sbc_${"a".repeat(32)}`;
const context = { params: Promise.resolve({ id: "creator-a" }) };
const request = (body: unknown) => new Request("https://localhost/api/owner/creators/creator-a/streamerbot-credentials", { method: "POST", body: JSON.stringify(body) });
describe("platform-owner credential management", () => {
  beforeEach(() => {
    mocks.session.mockReset().mockResolvedValue({ user: { email: "owner@example.test" } });
    mocks.trusted.mockReset().mockReturnValue(true); mocks.issue.mockReset(); mocks.list.mockReset(); mocks.revoke.mockReset();
  });
  it("requires platform owner authorization for list and every mutation", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(request({}), context)).status).toBe(401);
    for (const action of ["create", "rotate", "revoke"]) expect((await POST(request({ action, credentialId: id }), context)).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.issue).not.toHaveBeenCalled(); expect(mocks.revoke).not.toHaveBeenCalled();
  });
  it("rejects cross-origin mutations before provisioning", async () => {
    mocks.trusted.mockReturnValue(false);
    expect((await POST(request({ action: "create" }), context)).status).toBe(403);
    expect(mocks.issue).not.toHaveBeenCalled();
  });
  it.each([{ action: "create", creatorId: "other" }, { action: "rotate" }, { action: "revoke", credentialId: "bad" }, { action: "activate" }])("validates the mutation body %j", async (body) => {
    expect((await POST(request(body), context)).status).toBe(400);
    expect(mocks.issue).not.toHaveBeenCalled(); expect(mocks.revoke).not.toHaveBeenCalled();
  });
  it("returns the new secret only from issuance and disables response caching", async () => {
    mocks.issue.mockResolvedValue({ id, secret: "test-only-secret" });
    const response = await POST(request({ action: "create" }), context);
    expect(response.status).toBe(201); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ data: { secret: "test-only-secret" } });
    expect(mocks.issue).toHaveBeenCalledWith("creator-a", undefined);
    mocks.list.mockResolvedValue([{ id, status: "active" }]);
    const list = await GET(request({}), context);
    expect(list.headers.get("cache-control")).toBe("no-store");
    expect(await list.text()).not.toContain("test-only-secret");
  });
  it("scopes rotate/revoke to the URL creator", async () => {
    await POST(request({ action: "rotate", credentialId: id }), context);
    expect(mocks.issue).toHaveBeenCalledWith("creator-a", id);
    await POST(request({ action: "revoke", credentialId: id }), context);
    expect(mocks.revoke).toHaveBeenCalledWith("creator-a", id);
  });
  it("sanitizes errors from secrets, storage and authorization", async () => {
    mocks.issue.mockRejectedValue(new Error("SQL encrypted-secret-master-key"));
    const response = await POST(request({ action: "create" }), context);
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("encrypted-secret-master-key");
    mocks.session.mockRejectedValue(new Error("internal-session"));
    expect((await GET(request({}), context)).status).toBe(503);
  });
});
