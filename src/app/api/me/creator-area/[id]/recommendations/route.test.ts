import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ owner: "owner", demo: true }));
vi.mock("@/lib/env", () => ({ get isDemoMode() { return state.demo; }, env: {} }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
vi.mock("@/lib/api", () => ({ requireApiSession: async () => state.owner ? { user: { activeViewerId: state.owner } } : null,
  isTrustedAppMutationRequest: (r: Request) => r.headers.get("origin") === "https://ludylops.live" }));
import { createCreatorArea } from "@/lib/creators/service";
import { GET, POST, PATCH } from "./route";
let creatorId: string;
const item = { name: "Microfone", category: "Áudio", context: "Uso nas minhas lives.", href: "https://example.com/mic", imageUrl: "", storeLabel: "Loja", linkKind: "external", isActive: false };
const request = (data?: unknown, origin = "https://ludylops.live", query = "") => new Request(`https://ludylops.live/api/me/creator-area/id/recommendations${query}`, {
  method: data ? "POST" : "GET", headers: { origin }, ...(data ? { body: JSON.stringify(data) } : {}),
});
const context = () => ({ params: Promise.resolve({ id: creatorId }) });
beforeEach(async () => {
  state.owner = "owner"; state.demo = true; globalThis.__creatorTenantStore = []; globalThis.__creatorRecommendationsDemo = [];
  creatorId = (await createCreatorArea("owner", { displayName: "Canal A" })).creator.id;
});
describe("owner recommendations API", () => {
  it("creates, lists private drafts and edits with no-store responses", async () => {
    const id = randomUUID(); const created = await POST(request({ id, item }), context());
    expect(created.status).toBe(200); expect(created.headers.get("cache-control")).toBe("no-store");
    const read = await GET(request(), context()); expect(read.headers.get("cache-control")).toBe("no-store");
    expect((await read.json()).data.items).toEqual([{ id, ...item }]);
    expect((await PATCH(request({ id, item: { ...item, isActive: true }, expected: item }), context())).status).toBe(200);
    expect((await PATCH(request({ id, item: { ...item, name: "Antigo" }, expected: item }), context())).status).toBe(409);
  });
  it("requires session, trusted origin and owner", async () => {
    const body = { id: randomUUID(), item };
    state.owner = ""; expect((await GET(request(), context())).status).toBe(401);
    expect((await POST(request(body), context())).status).toBe(401);
    state.owner = "owner"; expect((await POST(request(body, "https://evil.test"), context())).status).toBe(403);
    state.owner = "other"; expect((await GET(request(), context())).status).toBe(404); expect((await POST(request(body), context())).status).toBe(404);
  });
  it("rejects unsafe URLs, injected fields, malformed JSON and invalid queries", async () => {
    for (const extra of [{ creatorId: "other" }, { href: "javascript:alert(1)" }, { moderationStatus: "approved" }])
      expect((await POST(request({ id: randomUUID(), item: { ...item, ...extra } }), context())).status).toBe(400);
    for (const query of ["?cursor=!!!", "?creatorId=other", "?cursor=a&cursor=b"]) expect((await GET(request(undefined, undefined, query), context())).status).toBe(400);
    expect((await PATCH(new Request("https://ludylops.live", { method: "PATCH", headers: { origin: "https://ludylops.live" }, body: "{" }), context())).status).toBe(400);
  });
  it("blocks disabled modules and sanitizes storage errors", async () => {
    globalThis.__creatorTenantStore![0].modules.find((m) => m.moduleKey === "product_recommendations")!.status = "disabled";
    expect((await GET(request(), context())).status).toBe(404);
    expect((await POST(request({ id: randomUUID(), item }), context())).status).toBe(404);
    state.demo = false; const response = await GET(request(), context()); expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("recommendation_storage_unavailable");
  });
});
