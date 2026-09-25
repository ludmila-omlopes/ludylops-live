import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), origin: vi.fn(), list: vi.fn(), issue: vi.fn(), revoke: vi.fn() }));
vi.mock("@/lib/api", () => ({ requireApiSession: mocks.session, isTrustedAppMutationRequest: mocks.origin }));
vi.mock("@/lib/streamerbot/credentials", async (original) => ({
  ...await original<typeof import("@/lib/streamerbot/credentials")>(),
  listOwnedStreamerbotCredentials: mocks.list, issueStreamerbotCredential: mocks.issue, revokeStreamerbotCredential: mocks.revoke,
}));
import { GET, POST } from "./route";
import { CredentialOperationError } from "@/lib/streamerbot/credentials";
const context = { params: Promise.resolve({ id: "creator-a" }) };
const credentialId = `sbc_${"a".repeat(32)}`;
const request = (payload: unknown) => new Request("https://example.com/api/me/creator-area/creator-a/streamerbot-credentials", {
  method: "POST", body: JSON.stringify(payload), headers: { "content-type": "application/json", origin: "https://example.com" },
});
describe("owner credential API", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.session.mockResolvedValue({ user: { activeViewerId: "owner-a", email: "owner@example.com" } });
    mocks.origin.mockReturnValue(true); mocks.list.mockResolvedValue({ credentials: [], canIssue: true });
    mocks.issue.mockResolvedValue({ id: credentialId, secret: "one-time-test-secret" }); mocks.revoke.mockResolvedValue({ id: credentialId, status: "revoked" });
  });
  it("requires an active viewer for reads and writes", async () => {
    for (const session of [null, { user: { email: "owner@example.com" } }]) {
      mocks.session.mockResolvedValue(session);
      expect((await GET(request({}), context)).status).toBe(401);
      expect((await POST(request({ action: "create" }), context)).status).toBe(401);
    }
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.issue).not.toHaveBeenCalled();
  });
  it("rejects untrusted origin and identity injected in the body", async () => {
    mocks.origin.mockReturnValue(false);
    expect((await POST(request({ action: "create" }), context)).status).toBe(403);
    mocks.origin.mockReturnValue(true);
    for (const payload of [{ action: "create", viewerId: "owner-b" }, { action: "create", creatorId: "b" }, { action: "rotate", credentialId: "bad" }, { action: "revoke", credentialId, authority: { kind: "platform" } }]) {
      expect((await POST(request(payload), context)).status).toBe(400);
    }
    expect(mocks.issue).not.toHaveBeenCalled(); expect(mocks.revoke).not.toHaveBeenCalled();
  });
  it("uses the session owner and URL for every operation; disables caching", async () => {
    const list = await GET(request({}), context);
    expect(mocks.list).toHaveBeenCalledWith("creator-a", "owner-a");
    expect(await list.json()).toEqual({ ok: true, data: { credentials: [], canIssue: true } });
    const create = await POST(request({ action: "create" }), context);
    expect(create.status).toBe(201); expect(create.headers.get("cache-control")).toBe("no-store");
    expect(mocks.issue).toHaveBeenCalledWith("creator-a", undefined, { kind: "owner", viewerId: "owner-a" });
    await POST(request({ action: "rotate", credentialId }), context);
    expect(mocks.issue).toHaveBeenLastCalledWith("creator-a", credentialId, { kind: "owner", viewerId: "owner-a" });
    const revoke = await POST(request({ action: "revoke", credentialId }), context);
    expect(mocks.revoke).toHaveBeenCalledWith("creator-a", credentialId, { kind: "owner", viewerId: "owner-a" });
    expect(await revoke.text()).not.toContain("secret");
  });
  it("preserves domain failures and sanitizes database/session errors", async () => {
    mocks.list.mockRejectedValue(new CredentialOperationError(404, "Streamer não encontrado."));
    expect((await GET(request({}), context)).status).toBe(404);
    mocks.issue.mockRejectedValue(new Error("encrypted_secret and private DB address"));
    const response = await POST(request({ action: "create" }), context);
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("encrypted_secret");
    mocks.session.mockRejectedValue(new Error("private session data"));
    expect((await GET(request({}), context)).status).toBe(503);
  });
});
