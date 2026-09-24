import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: vi.fn(), admin: vi.fn(), origin: vi.fn(), get: vi.fn(), edit: vi.fn(), dispatch: vi.fn(), auth: vi.fn(), guard: vi.fn() }));
vi.mock("@/lib/api", () => ({ requireApiSession: state.session, requireAdminApiSession: state.admin, isTrustedAppMutationRequest: state.origin }));
vi.mock("./periodic-messages.server", () => ({ getPeriodicMessages: state.get, editPeriodicMessages: state.edit, dispatchPeriodicMessages: state.dispatch }));
vi.mock("@/lib/streamerbot/authenticate", () => ({ authenticateStreamerbotRequest: state.auth, authorizeStreamerbotOperation: state.guard }));
import { GET, POST } from "@/app/api/me/creator-area/[id]/periodic-messages/route";
import { GET as adminGet } from "@/app/api/admin/periodic-messages/route";
import { POST as dispatch } from "@/app/api/internal/streamerbot/periodic-messages/route";
const context = { params: Promise.resolve({ id: "creator-a" }) };
const request = () => new Request("https://example.com", { method: "POST", body: JSON.stringify({ action: "create" }) });
beforeEach(() => {
  vi.resetAllMocks(); state.session.mockResolvedValue({ user: { activeViewerId: "owner-a" } });
  state.origin.mockReturnValue(true); state.get.mockResolvedValue({ items: [] });
  state.auth.mockResolvedValue({ ok: true, creatorId: "creator-a", raw: '{"action":"claim","isLive":true,"broadcastId":"broadcast-a"}' }); state.guard.mockResolvedValue(null);
});
describe("periodic message boundaries", () => {
  it("uses the session owner and returns private no-store settings", async () => {
    const response = await GET(new Request("https://example.com"), context);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.get).toHaveBeenCalledWith({ creatorId: "creator-a" }, { kind: "owner", ownerId: "owner-a" });
  });
  it("rejects anonymous, cross-origin mutations and non-admin legacy reads", async () => {
    state.session.mockResolvedValue(null); expect((await GET(new Request("https://example.com"), context)).status).toBe(401);
    state.origin.mockReturnValue(false); expect((await POST(request(), context)).status).toBe(403);
    expect((await adminGet(new Request("https://example.com"))).status).toBe(401);
    expect(state.get).not.toHaveBeenCalled(); expect(state.edit).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated or module-denied dispatches before storage", async () => {
    state.auth.mockResolvedValueOnce({ ok: false, response: new Response(null, { status: 401 }) });
    expect((await dispatch(request())).status).toBe(401);
    state.guard.mockResolvedValueOnce(new Response(null, { status: 403 }));
    expect((await dispatch(request())).status).toBe(403); expect(state.dispatch).not.toHaveBeenCalled();
  });
  it("takes creator identity from verified credentials and authorizes only periodic messages", async () => {
    state.dispatch.mockResolvedValue(null); expect((await dispatch(request())).status).toBe(200);
    expect(state.guard).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "creator-a" }), "periodic-messages");
    expect(state.dispatch).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "creator-a" }), { action: "claim", isLive: true, broadcastId: "broadcast-a" });
  });
});
