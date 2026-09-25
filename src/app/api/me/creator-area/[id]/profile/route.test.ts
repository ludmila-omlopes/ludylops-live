import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ owner: "owner", demo: true }));
vi.mock("@/lib/env", () => ({ get isDemoMode() { return state.demo; }, env: {} }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
vi.mock("@/lib/api", () => ({ requireApiSession: async () => state.owner ? { user: { activeViewerId: state.owner } } : null,
  isTrustedAppMutationRequest: (r: Request) => r.headers.get("origin") === "https://ludylops.live" }));
import { createCreatorArea } from "@/lib/creators/service";
import { GET, PATCH } from "./route";
let id: string;
const request = (data?: unknown, origin = "https://ludylops.live") => new Request("https://ludylops.live/api/me/creator-area/id/profile", {
  method: data ? "PATCH" : "GET", headers: { origin }, ...(data ? { body: JSON.stringify(data) } : {}),
});
const context = () => ({ params: Promise.resolve({ id }) });
const expected = { displayName: "Canal A", primaryColor: "#c7a2e9", accentColor: "#40a9ff" };
beforeEach(async () => {
  state.owner = "owner"; state.demo = true; globalThis.__creatorTenantStore = [];
  id = (await createCreatorArea("owner", { displayName: "Canal A" })).creator.id;
});
describe("owner profile API", () => {
  it("reads and saves only presentation fields with no-store responses", async () => {
    const read = await GET(request(), context());
    expect(read.headers.get("cache-control")).toBe("no-store"); expect((await read.json()).data).toEqual(expected);
    const response = await PATCH(request({ expected, profile: { ...expected, displayName: "Canal B" } }), context());
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await (await GET(request(), context())).json()).data.displayName).toBe("Canal B");
  });
  it("requires session, trusted origin and ownership", async () => {
    const input = { expected, profile: expected };
    state.owner = ""; expect((await GET(request(), context())).status).toBe(401);
    expect((await PATCH(request(input), context())).status).toBe(401);
    state.owner = "owner"; expect((await PATCH(request(input, "https://evil.test"), context())).status).toBe(403);
    state.owner = "other"; expect((await GET(request(), context())).status).toBe(404);
    expect((await PATCH(request(input), context())).status).toBe(404);
  });
  it.each(["slug", "ownerUserId", "status", "currencyLabel", "themeJson"])("rejects injected %s", async (field) => {
    expect((await PATCH(request({ expected, profile: { ...expected, [field]: "injected" } }), context())).status).toBe(400);
  });
  it("returns conflict for stale data and rejects malformed JSON", async () => {
    await PATCH(request({ expected, profile: { ...expected, displayName: "Novo" } }), context());
    expect((await PATCH(request({ expected, profile: { ...expected, displayName: "Antigo" } }), context())).status).toBe(409);
    const malformed = new Request("https://ludylops.live", { method: "PATCH", headers: { origin: "https://ludylops.live" }, body: "{" });
    expect((await PATCH(malformed, context())).status).toBe(400);
  });
  it("blocks inactive creators and sanitizes storage failures", async () => {
    globalThis.__creatorTenantStore![0].creator.status = "archived";
    expect((await PATCH(request({ expected, profile: expected }), context())).status).toBe(404);
    state.demo = false; const response = await GET(request(), context());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("profile_storage_unavailable");
  });
});
