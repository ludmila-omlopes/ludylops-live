import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ owner: "", demo: true }));
vi.mock("@/lib/env", () => ({ get isDemoMode() { return state.demo; }, env: {}, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
vi.mock("@/lib/api", () => ({ requireApiSession: async () => state.owner ? { user: { activeViewerId: state.owner } } : null,
  isTrustedAppMutationRequest: (request: Request) => request.headers.get("origin") === "https://ludylops.live" }));
import { ensureViewerFromStreamerbotIdentity, getQuoteDemoStore } from "@/lib/db/repository";
import { createCreatorArea } from "@/lib/creators/service";
import { GET, POST, PATCH } from "./route";
let creatorId: string, ownerId: string;
const request = (method = "GET", data?: unknown, query = "", origin = "https://ludylops.live") => new Request(`https://ludylops.live/api/me/creator-area/${creatorId}/quotes${query}`,
  { method, headers: { origin, "content-type": "application/json" }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
const context = () => ({ params: Promise.resolve({ id: creatorId }) });
beforeEach(async () => {
  state.demo = true; globalThis.__creatorTenantStore = []; globalThis.__lojaDemoStore = undefined;
  state.owner = ownerId = (await ensureViewerFromStreamerbotIdentity({ viewerExternalId: "UCabcdefghijklmnopqrstuv", initializeBalance: false })).id;
  creatorId = (await createCreatorArea(ownerId, { displayName: "Canal A" })).creator.id;
  getQuoteDemoStore({ creatorId }).quotes = [];
});
describe("owner quote API", () => {
  it("creates, lists and corrects with no-store responses", async () => {
    const id = randomUUID();
    const created = await POST(request("POST", { id, body: "Pérola" }), context());
    expect(created.status).toBe(200); expect(created.headers.get("cache-control")).toBe("no-store");
    const corrected = await PATCH(request("PATCH", { id, body: "Correção", expectedBody: "Pérola" }), context());
    expect(corrected.status).toBe(200);
    expect((await (await GET(request(), context())).json()).data.quotes[0].body).toBe("Correção");
    expect((await PATCH(request("PATCH", { id, body: "Antiga", expectedBody: "Pérola" }), context())).status).toBe(409);
  });
  it("requires a session and trusted origin and derives ownership server-side", async () => {
    const data = { id: randomUUID(), body: "Frase" };
    state.owner = "";
    expect((await GET(request(), context())).status).toBe(401);
    expect((await POST(request("POST", data), context())).status).toBe(401);
    state.owner = ownerId;
    expect((await POST(request("POST", data, "", "https://evil.test"), context())).status).toBe(403);
    expect((await PATCH(request("PATCH", { ...data, expectedBody: "Frase" }, "", "https://evil.test"), context())).status).toBe(403);
    state.owner = "another-owner";
    expect((await GET(request(), context())).status).toBe(404);
    expect((await POST(request("POST", data), context())).status).toBe(404);
  });
  it.each(["?before=0", "?before=-1", "?before=1.5", "?before=1&before=2", "?before=2147483648", "?creator=other", "?before="])("rejects invalid query %s", async (query) => {
    expect((await GET(request("GET", undefined, query), context())).status).toBe(400);
  });
  it("rejects malformed JSON, extra ownership fields and unknown quotes", async () => {
    const malformed = new Request("https://ludylops.live", { method: "POST", headers: { origin: "https://ludylops.live" }, body: "{" });
    expect((await POST(malformed, context())).status).toBe(400);
    expect((await POST(request("POST", { id: randomUUID(), body: "Texto", ownerId: "other" }), context())).status).toBe(400);
    expect((await PATCH(request("PATCH", { id: randomUUID(), body: "Texto", expectedBody: "Antigo" }), context())).status).toBe(404);
  });
  it("enforces module/lifecycle and sanitizes storage failures", async () => {
    const tenant = globalThis.__creatorTenantStore![0];
    tenant.modules.find((m) => m.moduleKey === "quotes")!.status = "disabled";
    expect((await GET(request(), context())).status).toBe(404);
    tenant.modules.find((m) => m.moduleKey === "quotes")!.status = "installed";
    tenant.creator.status = "archived";
    expect((await POST(request("POST", { id: randomUUID(), body: "Frase" }), context())).status).toBe(404);
    state.demo = false;
    const response = await GET(request(), context());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("quote_storage_unavailable");
  });
});
