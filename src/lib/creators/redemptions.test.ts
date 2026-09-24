import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
const state = vi.hoisted(() => ({ viewerId: "owner", trusted: true, creatorId: "", raw: "", authenticated: true }));
vi.mock("@/lib/env", () => ({ isDemoMode: true, env: {} }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
vi.mock("@/lib/api", () => ({ isTrustedAppMutationRequest: () => state.trusted, requireApiSession: async () => state.viewerId ? { user: { activeViewerId: state.viewerId } } : null }));
vi.mock("@/lib/creators/service", async (original) => ({ ...(await original<typeof import("./service")>()), getCreatorAreaBySlug: async () => globalThis.__creatorTenantStore?.find((t) => t.creator.id === state.creatorId) }));
vi.mock("@/lib/streamerbot/authenticate", () => ({
  authenticateStreamerbotRequest: async () => state.authenticated ? { ok: true, creatorId: state.creatorId, raw: state.raw } : { ok: false, response: new Response(null, { status: 401 }) },
  authorizeStreamerbotOperation: async () => null,
}));
import { createCreatorArea } from "./service";
import { defaultCreatorTenant } from "./tenant";
import { canUseModules } from "./module-access";
import { getViewerDashboard } from "@/lib/db/repository";
import { mutateCreatorEconomy } from "./economy";
import { economyMutationSchema } from "./economy-input";
import { listCreatorCatalog, purchaseCreatorItem, saveCreatorCatalog, listCreatorRedemptions } from "./redemptions.server";
import { creatorRedemptionRequest } from "./redemptions-api";
import { POST as integration } from "@/app/api/internal/streamerbot/redemptions/route";
let id: string;
const item = { id: "local", revision: 0, name: "Ação da live", description: "Um som", cost: 10, stock: 2, isActive: true, globalCooldownSeconds: 0, viewerCooldownSeconds: 0, streamerbotActionRef: "Action" };
beforeEach(async () => {
  globalThis.__creatorTenantStore = []; globalThis.__creatorEconomyDemo = undefined; globalThis.__creatorRedemptionsDemo = undefined; globalThis.__lojaDemoStore = undefined;
  state.trusted = true; state.viewerId = "owner"; state.authenticated = true;
  id = (await createCreatorArea("owner", { displayName: "Canal Cristal", currencyLabel: "cristais" })).creator.id; state.creatorId = id;
  await getViewerDashboard("nonexistent"); // Initialize the shared demo identities.
  const viewer = globalThis.__lojaDemoStore!.viewers[0]; state.viewerId = viewer.id;
  await saveCreatorCatalog(id, "owner", item);
  await mutateCreatorEconomy({ creatorId: id }, { kind: "owner", viewerId: "owner" }, { kind: "credit", viewerId: viewer.id, amount: 100, operationKey: "seed", reason: "Teste" });
});
const request = (body: unknown) => new Request("https://example.test/api/creators/canal-cristal/redeem", { method: "POST", body: JSON.stringify(body) });
describe("creator redemption adapters", () => {
  it("reserves receipt keys against generic integration/owner adjustments", () => {
    for (const prefix of ["redemption:", "redemption-refund:"]) expect(economyMutationSchema.safeParse({
      kind: "credit", viewerId: state.viewerId, operationKey: `${prefix}known-id`, amount: 100, reason: "Teste",
    }).success).toBe(false);
  });
  it("uses the session viewer and resolved community, rejects body overrides and foreign owners", async () => {
    const body = { itemId: "local", operationKey: randomUUID() };
    expect((await creatorRedemptionRequest(request({ ...body, viewerId: "victim" }), { slug: "canal-cristal" })).status).toBe(400);
    expect((await creatorRedemptionRequest(request({ ...body, creatorId: "other" }), { slug: "canal-cristal" })).status).toBe(400);
    expect((await creatorRedemptionRequest(request(item), { id })).status).toBe(403);
    expect((await creatorRedemptionRequest(request(body), { slug: "canal-cristal" })).status).toBe(200);
    expect((await listCreatorRedemptions(id, { kind: "owner", viewerId: "owner" }))[0].viewerId).toBe(state.viewerId);
    state.trusted = false; expect((await creatorRedemptionRequest(request(body), { slug: "canal-cristal" })).status).toBe(403);
    state.trusted = true; state.viewerId = ""; expect((await creatorRedemptionRequest(request(body), { slug: "canal-cristal" })).status).toBe(401);
  });
  it("binds bridge operations to authentication and validates callback bodies", async () => {
    const { id: redemptionId } = await purchaseCreatorItem(id, state.viewerId, { itemId: "local", operationKey: randomUUID() });
    state.raw = JSON.stringify({ operation: "claim", redemptionId, bridgeId: "worker", creatorId: "other" });
    expect((await integration(request({}))).status).toBe(400);
    state.raw = JSON.stringify({ operation: "claim", redemptionId, bridgeId: "worker" });
    state.authenticated = false; expect((await integration(request({}))).status).toBe(401);
    state.authenticated = true; const other = (await createCreatorArea("other-owner", { displayName: "Canal B" })).creator.id;
    state.creatorId = other; expect((await integration(request({}))).status).toBe(403);
    state.creatorId = id; expect((await integration(request({}))).status).toBe(200);
    expect((await integration(request({}))).status).toBe(200);
    expect((await (await integration(request({}))).json()).data).toBeNull();
  });
  it("allows only the new operation and keeps all legacy module surfaces closed", async () => {
    const tenant = globalThis.__creatorTenantStore![0];
    expect(canUseModules(tenant, ["redemptions"])).toBe(false);
    expect(canUseModules(tenant, ["redemptions"], "redemptions")).toBe(true);
    expect(canUseModules(tenant, ["points"], "redemptions")).toBe(false);
    expect(canUseModules(defaultCreatorTenant, ["redemptions"], "redemptions")).toBe(false);
    tenant.modules.find((m) => m.moduleKey === "points")!.status = "disabled";
    expect(canUseModules(tenant, ["redemptions"], "redemptions")).toBe(false);
    await expect(listCreatorCatalog(id, { kind: "public" })).rejects.toThrow();
  });
});
