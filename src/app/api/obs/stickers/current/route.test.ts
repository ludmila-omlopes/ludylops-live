import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/creators/tenant", () => ({ resolvePublicCreatorFromRequest: mocks.resolve }));
vi.mock("@/lib/streamerbot/stickers", () => ({ listSuperStickers: mocks.list }));
import { DEFAULT_CREATOR_MODULES } from "@/lib/creators/defaults";
import { GET } from "./route";
beforeEach(() => {
  vi.resetAllMocks(); mocks.resolve.mockResolvedValue({ creator: { id: "channel-a", status: "active" }, modules: structuredClone(DEFAULT_CREATOR_MODULES) });
  mocks.list.mockResolvedValue({ alerts: [], cursor: "2026-10-06T12:00:00.000Z|" });
});
const request = (query = "") => new Request(`https://ludylops.live/api/obs/stickers/current${query}`);
describe("Super Sticker public feed", () => {
  it("reads only the resolved creator and disables caching", async () => {
    const response = await GET(request("?creator=canal-a"));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.list).toHaveBeenCalledWith({ creatorId: "channel-a" }, undefined);
    expect(mocks.resolve).toHaveBeenCalledWith(expect.objectContaining({ slug: "canal-a" }));
  });
  it("rejects ambiguous creator selectors without resolving", async () => {
    expect((await GET(request("?creator=a&creator=b"))).status).toBe(403); expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled();
  });
  it.each(["unknown", "disabled", "missing-module", "missing-dependency"])("denies %s", async kind => {
    const modules = structuredClone(DEFAULT_CREATOR_MODULES).filter(m => m.moduleKey !== (kind === "missing-dependency" ? "streamerbot" : "obs_overlays"));
    mocks.resolve.mockResolvedValue(kind === "unknown" ? null : { creator: { id: "a", status: kind === "disabled" ? "disabled" : "active" }, modules });
    expect((await GET(request())).status).toBe(403); expect(mocks.list).not.toHaveBeenCalled();
  });
  it("does not expose lookup failures", async () => {
    mocks.resolve.mockRejectedValue(new Error("secret")); const response = await GET(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("secret");
  });
  it("validates cursors before storage", async () => {
    expect((await GET(request("?cursor=garbage"))).status).toBe(400); expect(mocks.list).not.toHaveBeenCalled();
  });
});
