import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../../bridge/src/config";
import { HostedApiClient } from "../../../bridge/src/api-client";
import { BridgeService } from "../../../bridge/src/service";
import { ActionRejectedError, StreamerbotClient } from "../../../bridge/src/streamerbot";
import { verifyCredentialSignature } from "@/lib/streamerbot/credential-crypto";
const config = () => loadConfig({ NODE_ENV: "test", BRIDGE_API_BASE_URL: "https://example.test", BRIDGE_MACHINE_KEY: "worker", STREAMERBOT_CREDENTIAL_ID: `sbc_${"a".repeat(32)}`, STREAMERBOT_CREDENTIAL_SECRET: "s".repeat(43) });
const redemption = { id: "id", catalogItemId: "local", viewerId: "viewer", viewer: null, costAtPurchase: 10, item: { slug: "local", streamerbotActionRef: "action-with-hyphen" } };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("per-creator bridge transport", () => {
  it("signs the exact endpoint/method/body and never sends creator IDs or legacy secrets", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true, data: [] })); vi.stubGlobal("fetch", fetchMock);
    const cfg = config(); const client = new HostedApiClient(cfg);
    await client.pullQueue({ bridgeId: "worker" });
    const [url, request] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe("/api/internal/streamerbot/redemptions");
    expect(JSON.parse(request.body as string)).toEqual({ operation: "pull", bridgeId: "worker" });
    const headers = new Headers(request.headers);
    expect(verifyCredentialSignature({ credentialId: cfg.STREAMERBOT_CREDENTIAL_ID!, timestamp: headers.get("x-timestamp")!, signature: headers.get("x-signature")!, secret: cfg.STREAMERBOT_CREDENTIAL_SECRET!, body: request.body as string, method: request.method!, pathname: url.pathname })).toBe(true);
    await client.completeRedemption("id", { bridgeId: "worker", executionNote: "Aceito" });
    const complete = fetchMock.mock.calls[1] as unknown as [URL, RequestInit];
    expect(JSON.parse(complete[1].body as string)).toEqual({ operation: "complete", redemptionId: "id", bridgeId: "worker", executionNote: "Aceito" });
    expect(() => loadConfig({ NODE_ENV: "test", BRIDGE_API_BASE_URL: "https://example.test", BRIDGE_MACHINE_KEY: "worker", STREAMERBOT_CREDENTIAL_ID: cfg.STREAMERBOT_CREDENTIAL_ID, BRIDGE_SHARED_SECRET: "legacy-secret" })).toThrow();
  });
  it("retains the legacy endpoint when no creator credentials are configured", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true, data: [] })); vi.stubGlobal("fetch", fetchMock);
    const cfg = loadConfig({ NODE_ENV: "test", BRIDGE_API_BASE_URL: "https://example.test", BRIDGE_MACHINE_KEY: "worker", BRIDGE_SHARED_SECRET: "legacy-secret" });
    await new HostedApiClient(cfg).pullQueue({ bridgeId: "worker" });
    const [url, request] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe("/api/internal/bridge/pull"); expect(new Headers(request.headers).has("x-streamerbot-credential-id")).toBe(false);
  });
  it("resolves names containing hyphens as names, not action GUIDs", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 })); vi.stubGlobal("fetch", fetchMock);
    await new StreamerbotClient(config(), { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }).executeRedemption(redemption);
    const call = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(JSON.parse(call[1].body as string).action).toEqual({ name: "action-with-hyphen" });
  });
  it("retries a lost completion without refunding or executing the action again", async () => {
    vi.spyOn(HostedApiClient.prototype, "claimRedemption").mockResolvedValue({ id: "id", status: "executing" });
    const complete = vi.spyOn(HostedApiClient.prototype, "completeRedemption").mockRejectedValueOnce(new Error("network")).mockResolvedValue({ id: "id", status: "completed" });
    const fail = vi.spyOn(HostedApiClient.prototype, "failRedemption").mockResolvedValue(null);
    const execute = vi.spyOn(StreamerbotClient.prototype, "executeRedemption").mockResolvedValue();
    const service = new BridgeService(config(), { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
    const worker = service as unknown as { running: boolean; handleRedemption: (r: typeof redemption) => Promise<void>; runPollLoop: () => Promise<void> };
    await worker.handleRedemption(redemption);
    vi.spyOn(HostedApiClient.prototype, "pullQueue").mockImplementation(async () => { service.stop(); return []; });
    worker.running = true; await worker.runPollLoop();
    expect(complete).toHaveBeenCalledTimes(2); expect(fail).not.toHaveBeenCalled(); expect(execute).toHaveBeenCalledTimes(1);
  });
  it("leaves ambiguous timeouts for inspection and refunds explicit action refusals", async () => {
    vi.spyOn(HostedApiClient.prototype, "claimRedemption").mockResolvedValue({ id: "id", status: "executing" });
    const fail = vi.spyOn(HostedApiClient.prototype, "failRedemption").mockResolvedValue({ id: "id", status: "failed" });
    const execute = vi.spyOn(StreamerbotClient.prototype, "executeRedemption").mockRejectedValueOnce(new Error("timeout"));
    const service = new BridgeService(config(), { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
    const worker = service as unknown as { handleRedemption: (r: typeof redemption) => Promise<void> };
    await worker.handleRedemption(redemption); expect(fail).not.toHaveBeenCalled();
    execute.mockRejectedValueOnce(new ActionRejectedError("Unknown action"));
    await worker.handleRedemption(redemption); expect(fail).toHaveBeenCalledOnce();
  });
});
