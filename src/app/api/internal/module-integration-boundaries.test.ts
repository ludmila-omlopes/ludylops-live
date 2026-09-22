import { afterEach, describe, expect, it, vi } from "vitest";
const effect = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
vi.mock("@/lib/env", () => ({ isDemoMode: true, env: { BRIDGE_SHARED_SECRET: "test-bridge", STEAM_SYNC_SECRET: "test-steam" } }));
vi.mock("@/lib/db/repository", () => ({ bridgePull: effect, bridgeHeartbeat: effect, bridgeClaim: effect, bridgeComplete: effect, bridgeFail: effect, syncSteamGameSuggestionPrices: effect }));
import { defaultCreatorTenant } from "@/lib/creators/tenant";
import { buildSignature } from "@/lib/streamerbot/security";
import { POST as pull } from "./bridge/pull/route";
import { POST as heartbeat } from "./bridge/heartbeat/route";
import { POST as claim } from "./bridge/[redemptionId]/claim/route";
import { POST as complete } from "./bridge/[redemptionId]/complete/route";
import { POST as fail } from "./bridge/[redemptionId]/fail/route";
import { POST as sync } from "./steam/sync/route";
const original = structuredClone(defaultCreatorTenant.modules);
describe("legacy integration adapters", () => {
  afterEach(() => { defaultCreatorTenant.modules = structuredClone(original); effect.mockReset(); });
  it.each([["pull", pull], ["heartbeat", heartbeat], ["claim", claim], ["complete", complete], ["fail", fail]] as const)("blocks signed bridge %s before parsing/effects", async (name, handler) => {
    defaultCreatorTenant.modules = original.filter(row => row.moduleKey !== "redemptions");
    const body = "invalid-json"; const timestamp = `${Date.now()}`;
    const signature = buildSignature({ body, timestamp, secret: "test-bridge" });
    const response = await handler(new Request(`https://foreign.test/api/internal/bridge/${name}?creator=foreign`, { method: "POST", body, headers: { "x-timestamp": timestamp, "x-signature": signature } }), { params: Promise.resolve({ redemptionId: "test" }) });
    expect(response.status).toBe(403);
    expect(effect).not.toHaveBeenCalled();
  });
  it("blocks authenticated Steam sync when suggestions are disabled", async () => {
    defaultCreatorTenant.modules = original.filter(row => row.moduleKey !== "game_suggestions");
    expect((await sync(new Request("https://foreign.test/api/internal/steam/sync", { method: "POST", headers: { authorization: "Bearer test-steam" } })))).toHaveProperty("status", 403);
    expect(effect).not.toHaveBeenCalled();
  });
});
