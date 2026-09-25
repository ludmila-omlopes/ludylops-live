import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ demo: true, db: vi.fn(), env: { CREATOR_ECONOMY_ENABLED: "true" } }));
vi.mock("@/lib/env", () => ({ get isDemoMode() { return state.demo; }, env: state.env, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
import { GET } from "./route";
import { createCreatorArea } from "@/lib/creators/service";
import { getViewerPoints, ensureViewerFromStreamerbotIdentity } from "@/lib/db/repository";
import { mutateCreatorEconomy } from "@/lib/creators/economy";

let a: string, b: string;
const request = (slug = "canal-a", query = "", hostname = "ludylops.live", extra: Record<string, string> = {}) =>
  GET(new Request(`https://${hostname}/api/c/${slug}/ranking${query}`, { headers: extra }), { params: Promise.resolve({ creatorSlug: slug }) });
beforeEach(async () => {
  state.demo = true; state.env.CREATOR_ECONOMY_ENABLED = "true"; state.db.mockReset().mockReturnValue(null);
  globalThis.__creatorTenantStore = []; globalThis.__creatorEconomyDemo = undefined; globalThis.__lojaDemoStore = undefined;
  await getViewerPoints("initialize");
  a = (await createCreatorArea("owner-a", { displayName: "Canal A", currencyLabel: "cristais" })).creator.id;
  b = (await createCreatorArea("owner-b", { displayName: "Canal B", currencyLabel: "estrelas" })).creator.id;
  const viewer = await ensureViewerFromStreamerbotIdentity({ viewerExternalId: "UCabcdefghijklmnopqrstuv", youtubeDisplayName: "Lia", initializeBalance: false });
  viewer.excludeFromRanking = false;
  for (const [creatorId, owner, amount] of [[a, "owner-a", 20], [b, "owner-b", 90]] as const)
    await mutateCreatorEconomy({ creatorId }, { kind: "owner", viewerId: owner }, { kind: "credit", viewerId: viewer.id, amount, operationKey: "event", reason: "Motivo privado" });
});
describe("public community ranking API", () => {
  it("requires no session and returns only this community's public projection without caching", async () => {
    const response = await request();
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, data: { currencyLabel: "cristais", entries: [{ position: 1, displayName: "Lia", handle: null, currentBalance: 20 }] } });
    expect((await (await request("canal-b")).json()).data.entries[0].currentBalance).toBe(90);
  });
  it("accepts the registered host and rejects mismatched, unknown or forged creator selectors", async () => {
    for (const tenant of globalThis.__creatorTenantStore!) {
      tenant.domains = [{ id: `${tenant.creator.id}-domain`, creatorId: tenant.creator.id, hostname: `${tenant.creator.slug}.ludylops.live`, isPrimary: true, createdAt: new Date().toISOString() }];
    }
    expect((await request("canal-a", "", "canal-a.ludylops.live")).status).toBe(200);
    expect((await request("canal-a", "", "canal-b.ludylops.live")).status).toBe(404);
    expect((await request("canal-a", "", "unknown.invalid")).status).toBe(404);
    expect((await request("missing")).status).toBe(404);
    expect((await request("ludylops")).status).toBe(404);
    expect((await request("canal-a", "", "ludylops.live", { "x-creator-slug": "canal-b" })).status).toBe(404);
    expect((await request("canal-a", "", "ludylops.live", { "x-forwarded-host": "canal-b.ludylops.live" })).status).toBe(404);
  });
  it.each(["?limit=0", "?limit=101", "?limit=all", "?limit=1.5", "?limit=", "?limit=1&limit=2", "?creator=canal-b", "?viewerId=secret"])("rejects invalid query %s", async (query) => {
    const response = await request("canal-a", query);
    expect(response.status).toBe(400); expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("honors limit and rechecks modules/lifecycle on the next read", async () => {
    expect((await request("canal-a", "?limit=1")).status).toBe(200);
    const tenant = globalThis.__creatorTenantStore![0];
    tenant.modules.find((m) => m.moduleKey === "ranking")!.status = "disabled";
    expect((await request()).status).toBe(404);
    tenant.modules.find((m) => m.moduleKey === "ranking")!.status = "installed";
    tenant.modules.find((m) => m.moduleKey === "points")!.status = "disabled";
    expect((await request()).status).toBe(404);
    tenant.modules.find((m) => m.moduleKey === "points")!.status = "installed";
    tenant.creator.status = "archived";
    expect((await request()).status).toBe(404);
  });
  it("does not revive demo data when production storage fails and sanitizes the response", async () => {
    state.demo = false;
    state.db.mockImplementation(() => { throw new Error("private database connection details"); });
    const response = await request();
    expect(response.status).toBe(503); expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    expect(body).not.toContain("private"); expect(body).not.toContain("Lia");
  });
  it("does not publish ranks while the production economy is disabled", async () => {
    state.demo = false; state.env.CREATOR_ECONOMY_ENABLED = "false";
    expect((await request()).status).toBe(404);
  });
});
