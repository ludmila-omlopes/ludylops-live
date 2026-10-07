import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), authorize: vi.fn(), receive: vi.fn() }));
vi.mock("@/lib/streamerbot/authenticate", () => ({ authenticateStreamerbotRequest: mocks.authenticate, authorizeStreamerbotOperation: mocks.authorize }));
vi.mock("@/lib/streamerbot/stickers", () => ({ receiveSuperSticker: mocks.receive }));
import { POST } from "./route";
const auth = { ok: true, creatorId: "channel-a", mode: "credential", credentialId: "test", raw: '{"messageId":"m1"}' };
const request = () => new Request("https://ludylops.live/api/internal/streamerbot/stickers", { method: "POST" });
beforeEach(() => { vi.resetAllMocks(); mocks.authenticate.mockResolvedValue(auth); mocks.authorize.mockResolvedValue(null); mocks.receive.mockResolvedValue({ deduped: false }); });
describe("Super Sticker ingestion boundary", () => {
  it("uses verified credentials as the only creator identity", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledWith(auth, "stickers");
    expect(mocks.receive).toHaveBeenCalledWith(auth, expect.objectContaining({ messageId: "m1", stickerImageUrl: null }));
  });
  it.each([401, 503])("does not store events when authentication returns %i", async status => {
    mocks.authenticate.mockResolvedValue({ ok: false, response: new Response(null, { status }) });
    expect((await POST(request())).status).toBe(status); expect(mocks.receive).not.toHaveBeenCalled();
  });
  it("denies disabled modules before writing", async () => {
    mocks.authorize.mockResolvedValue(new Response(null, { status: 403 }));
    expect((await POST(request())).status).toBe(403); expect(mocks.receive).not.toHaveBeenCalled();
  });
  it.each(['{"messageId":"m1","creatorId":"channel-b"}', '{}', 'broken'])("rejects invalid or spoofed payload %s", async raw => {
    mocks.authenticate.mockResolvedValue({ ...auth, raw });
    expect((await POST(request())).status).toBe(400); expect(mocks.receive).not.toHaveBeenCalled();
  });
  it("returns a retryable failure without exposing database details", async () => {
    mocks.receive.mockRejectedValue(new Error("private DB details"));
    const response = await POST(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private");
  });
});
