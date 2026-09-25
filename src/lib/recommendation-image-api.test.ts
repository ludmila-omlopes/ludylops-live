import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ demo: true, owner: "owner", admin: true, module: true, lookup: vi.fn() }));
vi.mock("@/lib/env", () => ({ get isDemoMode() { return state.demo; }, env: {} }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
vi.mock("@/lib/api", () => ({
  requireApiSession: async () => state.owner ? { user: { activeViewerId: state.owner } } : null,
  requireAdminApiSession: async () => state.admin ? { user: { email: "admin@example.com" } } : null,
  isTrustedAppMutationRequest: (r: Request) => r.headers.get("origin") === "https://ludylops.live",
}));
vi.mock("@/lib/creators/module-access", async (original) => ({
  ...(await original<typeof import("@/lib/creators/module-access")>()),
  guardModuleRequest: async () => state.module ? null : Response.json({ ok: false }, { status: 403 }),
}));
vi.mock("@/lib/recommendation-image.server", () => ({ limitedRecommendationImage: state.lookup }));
import { createCreatorArea } from "@/lib/creators/service";
import { RecommendationImageError } from "./recommendation-image";
import { POST as ownerLookup } from "@/app/api/me/creator-area/[id]/recommendations/image/route";
import { POST as adminLookup } from "@/app/api/admin/recommendations/image/route";
let id: string;
const ctx = () => ({ params: Promise.resolve({ id }) });
const request = (body: unknown = { href: "https://www.amazon.com.br/dp/item" }, origin = "https://ludylops.live") =>
  new Request("https://ludylops.live/api/image", { method: "POST", headers: { origin }, body: typeof body === "string" ? body : JSON.stringify(body) });
beforeEach(async () => {
  state.demo = true; state.owner = "owner"; state.admin = true; state.module = true;
  state.lookup.mockReset().mockResolvedValue({ imageUrl: "https://m.media-amazon.com/image.jpg" });
  globalThis.__creatorTenantStore = []; globalThis.__creatorRecommendationsDemo = [];
  id = (await createCreatorArea("owner", { displayName: "Canal A" })).creator.id;
});
describe("authorized image lookup APIs", () => {
  it("returns only the image with no-store and never persists products", async () => {
    for (const response of [await ownerLookup(request(), ctx()), await adminLookup(request())]) {
      expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ ok: true, data: { imageUrl: "https://m.media-amazon.com/image.jpg" } });
    }
    expect(state.lookup).toHaveBeenCalledWith("owner:owner", "https://www.amazon.com.br/dp/item");
    expect(state.lookup).toHaveBeenCalledWith("admin:admin@example.com", "https://www.amazon.com.br/dp/item");
    expect(globalThis.__creatorRecommendationsDemo).toEqual([]);
  });
  it("checks trusted origin, session, ownership, lifecycle and module before fetching", async () => {
    expect((await ownerLookup(request(undefined, "https://evil.test"), ctx())).status).toBe(403);
    expect((await adminLookup(request(undefined, "https://evil.test"))).status).toBe(403);
    state.admin = false; expect((await adminLookup(request())).status).toBe(403);
    state.admin = true; state.module = false; expect((await adminLookup(request())).status).toBe(403);
    state.owner = ""; expect((await ownerLookup(request(), ctx())).status).toBe(401);
    state.owner = "other"; expect((await ownerLookup(request(), ctx())).status).toBe(404);
    state.owner = "owner"; globalThis.__creatorTenantStore![0].creator.status = "archived";
    expect((await ownerLookup(request(), ctx())).status).toBe(404);
    globalThis.__creatorTenantStore![0].creator.status = "active";
    globalThis.__creatorTenantStore![0].modules.find((m) => m.moduleKey === "product_recommendations")!.status = "disabled";
    expect((await ownerLookup(request(), ctx())).status).toBe(404); expect(state.lookup).not.toHaveBeenCalled();
  });
  it("rejects invalid JSON, oversized requests, injected scope and legacy/unknown creators", async () => {
    for (const body of ["{", "x".repeat(4097), { href: "" }, { href: "https://www.amazon.com.br/item", creatorId: "other" }]) {
      expect((await ownerLookup(request(body), ctx())).status).toBe(400);
      expect((await adminLookup(request(body))).status).toBe(400);
    }
    for (const target of ["creator_ludylops", "missing"]) {
      id = target; expect((await ownerLookup(request(), ctx())).status).toBe(404);
    }
    expect(state.lookup).not.toHaveBeenCalled();
  });
  it("uses a clear manual fallback for missing/blocked stores and sanitizes internal errors", async () => {
    for (const [code, status] of [["unsupported", 422], ["no_image", 422], ["unavailable", 503], ["rate_limit", 429]] as const) {
      state.lookup.mockRejectedValueOnce(new RecommendationImageError(code));
      const response = await ownerLookup(request(), ctx()); expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("no-store");
      if (code !== "rate_limit") expect((await response.json()).error).toContain("manualmente");
    }
    state.lookup.mockRejectedValueOnce(new Error("secret internal address"));
    const response = await adminLookup(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("secret");
    state.demo = false; expect((await ownerLookup(request(), ctx())).status).toBe(503);
  });
});
