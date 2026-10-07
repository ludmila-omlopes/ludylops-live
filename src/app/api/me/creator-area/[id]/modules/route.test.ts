import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: vi.fn(), db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: true }));
vi.mock("@/lib/api", async () => ({
  requireApiSession: state.session,
  ...(await vi.importActual("@/lib/request-origin")),
}));
import { GET, PUT } from "./route";
import { createCreatorArea } from "@/lib/creators/service";
import { listDemoCreatorTenants } from "@/lib/creators/demo-store";
import { hasLiveModules } from "@/lib/creators/modules";
import type { ModuleChoice } from "@/lib/creators/module-choices";

const base = "http://localhost:3000";
const context = (id: string) => ({ params: Promise.resolve({ id }) });
function request(id: string, body: unknown, origin: string | null = base) {
  return new Request(`${base}/api/me/creator-area/${id}/modules`, {
    method: "PUT", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  });
}
const modulesOf = (id: string) => listDemoCreatorTenants().find((tenant) => tenant.creator.id === id)!.modules;
const statuses = (id: string) => Object.fromEntries(modulesOf(id).map((module) => [module.moduleKey, module.status]));
const states = (choices: ModuleChoice[]) => Object.fromEntries(choices.map((choice) => [choice.key, [choice.state, choice.chosen]]));

beforeEach(() => {
  globalThis.__creatorTenantStore = [];
  state.db.mockReset().mockReturnValue(null);
  state.session.mockReset().mockResolvedValue({ user: { activeViewerId: "owner-a", email: "a@example.com" } });
});

describe("owner module choices endpoint", () => {
  it("activates products, records the rest as requested and keeps the community page-only", async () => {
    const a = await createCreatorArea("owner-a", { displayName: "Canal A" });
    const response = await PUT(request(a.creator.id, { modules: ["product_recommendations", "game_suggestions", "bets"] }), context(a.creator.id));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { data } = await response.json();
    expect(states(data)).toMatchObject({
      product_recommendations: ["active", true], game_suggestions: ["active", true], bets: ["soon", true],
      points: ["active", true], video_suggestions: ["off", false], ranking: ["off", false],
    });
    // Demo runs with the community economy on, so the currency bets need turns on too.
    expect(statuses(a.creator.id)).toEqual({ product_recommendations: "installed", game_suggestions: "installed", bets: "requested", points: "installed" });
    expect(modulesOf(a.creator.id).every((module) => typeof module.configJson.chosenAt === "string")).toBe(true);
    expect(modulesOf(a.creator.id).find((module) => module.moduleKey === "points")?.configJson.currencyLabel).toBe("pontos");
    expect(hasLiveModules(modulesOf(a.creator.id))).toBe(false);

    const read = await GET(new Request(base), context(a.creator.id));
    expect(states((await read.json()).data)).toEqual(states(data));
  });

  it("turns videos on alone, without the currency, and removes what the creator leaves out", async () => {
    const a = await createCreatorArea("owner-a", { displayName: "Canal A" });
    await PUT(request(a.creator.id, { modules: ["video_suggestions", "ranking"] }), context(a.creator.id));
    expect(statuses(a.creator.id)).toEqual({ video_suggestions: "installed", ranking: "installed", points: "installed" });
    expect(hasLiveModules(modulesOf(a.creator.id))).toBe(false);
    await PUT(request(a.creator.id, { modules: [] }), context(a.creator.id));
    // The currency keeps balances, so it stays once on.
    expect(Object.keys(statuses(a.creator.id))).toEqual(["points"]);
  });

  it("never touches the live modules installed by the platform", async () => {
    const a = await createCreatorArea("owner-a", { displayName: "Canal A" }, { liveFeatures: true });
    // Self-service modules are the creator's own; everything else stays as the platform installed it.
    const before = structuredClone(modulesOf(a.creator.id).filter((module) => !["product_recommendations", "game_suggestions", "video_suggestions", "creator_suggestions", "ranking"].includes(module.moduleKey)));
    const response = await PUT(request(a.creator.id, { modules: [] }), context(a.creator.id));
    expect(response.status).toBe(200);
    expect(modulesOf(a.creator.id)).toEqual(before);
  });

  it("only changes the session owner's community", async () => {
    const a = await createCreatorArea("owner-a", { displayName: "Canal A" });
    const b = await createCreatorArea("owner-b", { displayName: "Canal B" });
    const response = await PUT(request(b.creator.id, { modules: ["bets"] }), context(b.creator.id));
    expect(response.status).toBe(404);
    expect((await GET(new Request(base), context(b.creator.id))).status).toBe(404);
    expect(statuses(b.creator.id)).toEqual({ product_recommendations: "installed" });
    expect(statuses(a.creator.id)).toEqual({ product_recommendations: "installed" });
  });

  it("requires an active viewer session for both methods", async () => {
    state.session.mockResolvedValue(null);
    expect((await GET(new Request(base), context("id"))).status).toBe(401);
    expect((await PUT(request("id", { modules: [] }), context("id"))).status).toBe(401);
  });

  it.each([null, "https://attacker.example"])("rejects mutation origin %s before session/database access", async (origin) => {
    expect((await PUT(request("id", { modules: [] }, origin), context("id"))).status).toBe(403);
    expect(state.session).not.toHaveBeenCalled();
    expect(state.db).not.toHaveBeenCalled();
  });

  it.each([null, {}, { modules: ["streamerbot"] }, { modules: ["obs_overlays"] }, { modules: ["redemptions"] }, { modules: [], ownerUserId: "owner-a" }])(
    "rejects invalid or forged input %j", async (body) => {
      const a = await createCreatorArea("owner-a", { displayName: "Canal A" });
      expect((await PUT(request(a.creator.id, body), context(a.creator.id))).status).toBe(400);
      expect(statuses(a.creator.id)).toEqual({ product_recommendations: "installed" });
    });

  it("does not reveal session/storage errors", async () => {
    state.session.mockRejectedValue(new Error("PRIVATE database detail"));
    const response = await GET(new Request(base), context("id"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE");
  });
});
