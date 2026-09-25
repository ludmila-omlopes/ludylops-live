import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ record: vi.fn(), enabled: vi.fn(), quotesEnabled: vi.fn(), used: vi.fn(), effect: vi.fn(), economyRead: vi.fn(), economyWrite: vi.fn() }));
vi.mock("@/lib/creators/economy-api", async (original) => ({
  ...await original<typeof import("@/lib/creators/economy-api")>(),
  readIntegrationChannelEconomy: state.economyRead, mutateChannelEconomy: state.economyWrite,
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/env", () => ({ isDemoMode: true, env: { STREAMERBOT_SHARED_SECRET: "legacy-test", STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") } }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
vi.mock("@/lib/streamerbot/credentials", async (original) => ({
  ...await original<typeof import("@/lib/streamerbot/credentials")>(), findStreamerbotCredential: state.record,
  streamerbotCreatorIsEnabled: state.enabled, markStreamerbotCredentialUsed: state.used,
  streamerbotQuoteModuleIsEnabled: state.quotesEnabled,
}));
vi.mock("@/lib/db/repository", () => ({
  ingestStreamerbotEvent: state.effect, claimViewerLinkCodeFromStreamerbot: state.effect,
  getViewerBalanceFromChatCommand: state.effect, placeBetFromChatCommand: state.effect,
  runStreamerbotCounterCommand: state.effect, runDeathCounterCommand: state.effect,
  runQuoteCommandFromChat: state.effect, getPipetzPricing: state.effect,
}));
vi.mock("@/lib/wheel", () => ({ triggerWheelSpin: state.effect }));
import { POST as events } from "./events/route";
import { POST as link } from "./link/route";
import { POST as points } from "./points/route";
import { POST as bets } from "./bets/place/route";
import { POST as counters } from "./counters/route";
import { POST as deaths } from "./deaths/route";
import { POST as quotes } from "./quotes/route";
import { POST as wheel } from "./wheel/route";
import { POST as check } from "./credentials/check/route";
import { POST as economy } from "./economy/route";
import { buildCredentialSignature, encryptCredentialSecret } from "@/lib/streamerbot/credential-crypto";
import { defaultCreatorTenant } from "@/lib/creators/tenant";
import { listDemoCreatorTenants } from "@/lib/creators/demo-store";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { buildSignature } from "@/lib/streamerbot/security";
const routes = [ ["events", events], ["link", link], ["points", points], ["bets/place", bets], ["counters", counters], ["deaths", deaths], ["quotes", quotes], ["wheel", wheel] ] as const;
const id = `sbc_${"a".repeat(32)}`;
const secret = "new-test";
const originalDefaultModules = structuredClone(defaultCreatorTenant.modules);
function setCreator(creatorId: string) {
  state.record.mockResolvedValue({ id, creatorId, status: "active", revokedAt: null,
    encryptedSecret: encryptCredentialSecret(secret, id, creatorId, Buffer.alloc(32, 7).toString("base64")) });
}
function request(path: string, legacy = false, body = "not-json") {
  const timestamp = `${Date.now()}`;
  const pathname = `/api/internal/streamerbot/${path}`;
  return new Request(`https://untrusted.example${pathname}`, { method: "POST", body, headers: {
    "x-creator-slug": "ludylops", "x-timestamp": timestamp,
    "x-signature": legacy ? buildSignature({ body, timestamp, secret: "legacy-test" }) : buildCredentialSignature({ body, timestamp, pathname, secret, method: "POST", credentialId: id }),
    ...(legacy ? {} : { "x-streamerbot-credential-id": id }),
  } });
}
describe("credential rollout at every Streamer.bot handler", () => {
  afterEach(() => { defaultCreatorTenant.modules = structuredClone(originalDefaultModules); });
  beforeEach(() => {
    defaultCreatorTenant.modules = structuredClone(originalDefaultModules);
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    state.effect.mockReset(); state.used.mockReset(); state.enabled.mockReset().mockResolvedValue(true);
    state.quotesEnabled.mockReset().mockResolvedValue(true);
    listDemoCreatorTenants().splice(0, Infinity, { ...structuredClone(defaultCreatorTenant), creator: { ...defaultCreatorTenant.creator, id: "creator-other" } });
    setCreator("creator-other");
  });
  it.each(routes.filter(([path]) => path !== "points"))("%s denies another creator before parsing/effects", async (path, handler) => {
    const response = await handler(request(path, false, path === "quotes" ? JSON.stringify({ action: "show", quoteId: 1, viewerExternalId: "viewer", source: "streamerbot_chat" }) : "not-json"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "operation_not_isolated" });
    expect(state.effect).not.toHaveBeenCalled();
  });
  it("passes only verified currency identity to balance reads and transactions", async () => {
    state.economyRead.mockResolvedValue({ viewerId: "viewer", currencyLabel: "cristais", balance: { currentBalance: 9, lifetimeEarned: 9, lifetimeSpent: 0 } });
    const payload = { viewerExternalId: "UCabcdefghijklmnopqrstuv", creatorId: DEFAULT_CREATOR_ID };
    expect((await points(request("points", false, JSON.stringify(payload)))).status).toBe(200);
    expect(state.economyRead).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "creator-other" }), expect.objectContaining({ viewerExternalId: payload.viewerExternalId }));
    state.economyWrite.mockResolvedValue({ duplicate: false });
    expect((await economy(request("economy", false, JSON.stringify({ kind: "credit", amount: 1 })))).status).toBe(200);
    expect(state.economyWrite).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "creator-other" }), { kind: "integration" }, { kind: "credit", amount: 1 });
    // Reusing a valid signature on another endpoint must fail authentication.
    const signedForPoints = request("points", false, "{}");
    const replay = new Request("https://untrusted.example/api/internal/streamerbot/economy", {
      method: "POST", body: "{}", headers: signedForPoints.headers,
    });
    expect((await economy(replay)).status).toBe(401);
  });
  it.each(routes)("%s denies a disabled default creator with new or legacy authentication", async (path, handler) => {
    setCreator(DEFAULT_CREATOR_ID); state.enabled.mockResolvedValue(false);
    for (const legacy of [true, false]) expect((await handler(request(path, legacy))).status).toBe(403);
    expect(state.effect).not.toHaveBeenCalled();
  });
  it("accepts the default creator's new credential for an operational event", async () => {
    setCreator(DEFAULT_CREATOR_ID); state.effect.mockResolvedValue({ stored: true });
    const payload = { eventId: "test", eventType: "presence_tick", viewerExternalId: "test-viewer", occurredAt: new Date().toISOString(), payload: {} };
    const response = await events(request("events", false, JSON.stringify(payload)));
    expect(response.status).toBe(200);
    expect(state.effect).toHaveBeenCalledTimes(1);
  });
  it.each(routes)("%s rejects disabled operations even with a valid enabled integration", async (path, handler) => {
    setCreator(DEFAULT_CREATOR_ID);
    defaultCreatorTenant.modules = originalDefaultModules.map(row => ({ ...row, status: row.moduleKey === "streamerbot" ? "installed" : "disabled" }));
    // Counter/death operations belong to the integration itself.
    if (path === "counters" || path === "deaths") defaultCreatorTenant.modules = [];
    const payload = path === "quotes" ? JSON.stringify({ action: "get", source: "streamerbot_chat" }) : "not-json";
    for (const legacy of [true, false]) expect((await handler(request(path, legacy, payload))).status).toBe(403);
    expect(state.effect).not.toHaveBeenCalled();
  });
  it("denies scoped quote actions when a transitive dependency is missing", async () => {
    listDemoCreatorTenants()[0].modules = listDemoCreatorTenants()[0].modules.filter(row => row.moduleKey !== "streamerbot");
    expect((await quotes(request("quotes", false, JSON.stringify({ action: "get", source: "streamerbot_chat" })))).status).toBe(403);
    expect(state.effect).not.toHaveBeenCalled();
  });
  it("denies like-goal rewards when OBS is disabled while keeping presence events available", async () => {
    setCreator(DEFAULT_CREATOR_ID);
    defaultCreatorTenant.modules = originalDefaultModules.map(row => ({ ...row, status: row.moduleKey === "obs_overlays" ? "disabled" : row.status }));
    const payload = { eventId: "test", eventType: "like_count_update", occurredAt: new Date().toISOString(), payload: {} };
    expect((await events(request("events", false, JSON.stringify(payload)))).status).toBe(403);
    expect(state.effect).not.toHaveBeenCalled();
    state.effect.mockResolvedValue({ stored: true });
    expect((await events(request("events", false, JSON.stringify({ ...payload, eventType: "presence_tick", viewerExternalId: "test" })))).status).toBe(200);
  });
  it.each(["create", "get"])("allows scoped quote %s using verified identity despite forged hints", async action => {
    state.effect.mockResolvedValue({ action, quote: { quoteNumber: 1, body: "Frase" }, viewer: null });
    const payload = { action, quoteText: "Frase", quoteId: 1, viewerExternalId: "viewer", source: "streamerbot_chat", creatorId: DEFAULT_CREATOR_ID };
    const response = await quotes(request("quotes", false, JSON.stringify(payload)));
    expect(response.status).toBe(200);
    expect(state.effect).toHaveBeenCalledWith({ creatorId: "creator-other" }, expect.objectContaining({ action }));
    expect(state.effect).toHaveBeenCalledTimes(1);
    expect(state.quotesEnabled).toHaveBeenCalledWith("creator-other");
  });
  it("denies quote reads when the authenticated creator's quotes module is disabled", async () => {
    state.quotesEnabled.mockResolvedValue(false);
    expect((await quotes(request("quotes", false, JSON.stringify({ action: "get", source: "streamerbot_chat" })))).status).toBe(403);
    expect(state.effect).not.toHaveBeenCalled();
  });
  it("reports scoped quote actions without enabling unscoped operations or invoking repositories", async () => {
    const response = await check(request("credentials/check"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { creatorId: "creator-other", credentialId: id, operationalAccess: false, quoteActions: ["create", "get"] } });
    expect(state.effect).not.toHaveBeenCalled();
  });
  it("reports disabled quotes and fails closed when their availability cannot be checked", async () => {
    state.quotesEnabled.mockResolvedValue(false);
    expect(await (await check(request("credentials/check"))).json()).toMatchObject({ data: { quoteActions: [] } });
    state.quotesEnabled.mockRejectedValue(new Error("database unavailable"));
    expect((await check(request("credentials/check"))).status).toBe(503);
    expect(state.effect).not.toHaveBeenCalled();
  });
});
