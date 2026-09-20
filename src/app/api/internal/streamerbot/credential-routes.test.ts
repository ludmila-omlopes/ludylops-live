import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ record: vi.fn(), enabled: vi.fn(), used: vi.fn(), effect: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { STREAMERBOT_SHARED_SECRET: "legacy-test", STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") } }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
vi.mock("@/lib/streamerbot/credentials", async (original) => ({
  ...await original<typeof import("@/lib/streamerbot/credentials")>(), findStreamerbotCredential: state.record,
  streamerbotCreatorIsEnabled: state.enabled, markStreamerbotCredentialUsed: state.used,
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
import { buildCredentialSignature, encryptCredentialSecret } from "@/lib/streamerbot/credential-crypto";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";
import { buildSignature } from "@/lib/streamerbot/security";
const routes = [ ["events", events], ["link", link], ["points", points], ["bets/place", bets], ["counters", counters], ["deaths", deaths], ["quotes", quotes], ["wheel", wheel] ] as const;
const id = `sbc_${"a".repeat(32)}`;
const secret = "new-test";
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
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    state.effect.mockReset(); state.used.mockReset(); state.enabled.mockReset().mockResolvedValue(true);
    setCreator("creator-other");
  });
  it.each(routes)("%s denies another creator before parsing/effects", async (path, handler) => {
    const response = await handler(request(path));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "operation_not_isolated" });
    expect(state.effect).not.toHaveBeenCalled();
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
  it("checks non-default credentials without enabling operations or invoking repositories", async () => {
    const response = await check(request("credentials/check"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { creatorId: "creator-other", credentialId: id, operationalAccess: false } });
    expect(state.effect).not.toHaveBeenCalled();
  });
});
