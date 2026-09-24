import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ demo: false, env: { CREATOR_ECONOMY_ENABLED: "true" }, tenant: vi.fn(), load: vi.fn(), cache: vi.fn() }));
vi.mock("@/lib/env", () => ({ get isDemoMode() { return state.demo; }, env: state.env }));
vi.mock("next/cache", () => ({ unstable_cache: state.cache }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
vi.mock("./module-access", async (original) => ({ ...(await original<typeof import("./module-access")>()), loadModuleTenant: state.tenant }));
vi.mock("./ranking", async (original) => ({ ...(await original<typeof import("./ranking")>()), readCreatorRanking: state.load }));
vi.mock("./service", () => ({ getCreatorAreaBySlug: (slug: string) => state.tenant({ creatorId: slug }) }));
import { readPublicCreatorRanking } from "./ranking-cache";
import { CreatorRankingUnavailableError } from "./ranking";
import { GET as rankingApi } from "@/app/api/c/[creatorSlug]/ranking/route";
const active = (id = "a") => ({ creator: { id, status: "active" }, modules: [{ moduleKey: "points", status: "installed" }, { moduleKey: "ranking", status: "installed" }] });
beforeEach(() => {
  state.demo = false; state.env.CREATOR_ECONOMY_ENABLED = "true";
  state.tenant.mockReset().mockImplementation(async ({ creatorId }) => active(creatorId));
  state.load.mockReset().mockImplementation(async ({ creatorId }, limit) => ({ currencyLabel: creatorId, entries: [{ position: 1, displayName: "Lia", handle: null, currentBalance: limit }] }));
  const values = new Map();
  state.cache.mockReset().mockImplementation((fn, keys) => async (...args: unknown[]) => {
    const key = JSON.stringify([keys, args]); if (!values.has(key)) values.set(key, await fn(...args)); return values.get(key);
  });
});
describe("public ranking cache authorization", () => {
  it("rechecks access on hits and keeps communities and limits independent", async () => {
    const a = await readPublicCreatorRanking({ creatorId: "a" }, 10);
    expect(await readPublicCreatorRanking({ creatorId: "a" }, 10)).toEqual(a);
    expect((await readPublicCreatorRanking({ creatorId: "b" }, 10)).currencyLabel).toBe("b");
    await readPublicCreatorRanking({ creatorId: "a" }, 20);
    expect(state.load).toHaveBeenCalledTimes(3); expect(state.tenant).toHaveBeenCalledTimes(4);
  });
  it("denies a warm cache after creator/module/activation changes and on policy lookup failure", async () => {
    await readPublicCreatorRanking({ creatorId: "a" });
    for (const tenant of [null, { ...active(), creator: { id: "a", status: "archived" } },
      { ...active(), creator: { id: "a", status: "disabled" } },
      ...["points", "ranking"].map((key) => ({ ...active(), modules: active().modules.map((m) => ({ ...m, status: m.moduleKey === key ? "disabled" : m.status })) }))]) {
      state.tenant.mockResolvedValue(tenant);
      await expect(readPublicCreatorRanking({ creatorId: "a" })).rejects.toBeInstanceOf(CreatorRankingUnavailableError);
    }
    state.tenant.mockResolvedValue(active()); state.env.CREATOR_ECONOMY_ENABLED = "false";
    await expect(readPublicCreatorRanking({ creatorId: "a" })).rejects.toBeInstanceOf(CreatorRankingUnavailableError);
    state.env.CREATOR_ECONOMY_ENABLED = "true"; state.tenant.mockRejectedValue(new Error("policy offline"));
    await expect(readPublicCreatorRanking({ creatorId: "a" })).rejects.toThrow("policy offline");
    expect(state.load).toHaveBeenCalledTimes(1); expect(state.cache).toHaveBeenCalledTimes(1);
  });
  it("rejects legacy/missing scope and invalid limits and bypasses cache in demo", async () => {
    await expect(readPublicCreatorRanking({ creatorId: "creator_ludylops" })).rejects.toBeInstanceOf(CreatorRankingUnavailableError);
    await expect(readPublicCreatorRanking({ creatorId: "" })).rejects.toThrow("creator_context_required");
    for (const limit of [0, 101, -1, 1.2]) await expect(readPublicCreatorRanking({ creatorId: "a" }, limit)).rejects.toThrow("invalid_ranking_limit");
    expect(state.cache).not.toHaveBeenCalled();
    state.demo = true;
    await readPublicCreatorRanking({ creatorId: "a" }); await readPublicCreatorRanking({ creatorId: "a" });
    expect(state.load).toHaveBeenCalledTimes(2); expect(state.cache).not.toHaveBeenCalled();
  });
  it("leaves the public API on its uncached repository path with no-store responses", async () => {
    for (let i = 0; i < 2; i++) {
      const response = await rankingApi(new Request("https://ludylops.live/api/c/a/ranking"), { params: Promise.resolve({ creatorSlug: "a" }) });
      expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(state.load).toHaveBeenCalledTimes(2); expect(state.cache).not.toHaveBeenCalled();
  });
});
