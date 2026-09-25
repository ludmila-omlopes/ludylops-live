import { beforeEach, describe, expect, it, vi } from "vitest";
const store = vi.hoisted(() => ({ find: vi.fn(), enabled: vi.fn(), used: vi.fn() }));
const settings = vi.hoisted(() => ({ STREAMERBOT_SHARED_SECRET: "legacy-test", STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY: "", STREAMERBOT_LEGACY_AUTH_ENABLED: "true" }));
vi.mock("@/lib/env", () => ({ env: settings }));
vi.mock("./credentials", async (original) => {
  // Keep lifecycle verification real while replacing only storage boundaries.
  const actual = await original<typeof import("./credentials")>();
  return { ...actual, findStreamerbotCredential: store.find, streamerbotCreatorIsEnabled: store.enabled, markStreamerbotCredentialUsed: store.used };
});
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
import { authenticateStreamerbotRequest, authorizeStreamerbotOperation } from "./authenticate";
import { buildCredentialSignature, encryptCredentialSecret } from "./credential-crypto";
import { buildSignature } from "./security";
import { DEFAULT_CREATOR_ID } from "@/lib/creators/defaults";

const id = `sbc_${"a".repeat(32)}`;
const secret = "credential-test-secret";
function request(options: { legacy?: boolean; id?: string; creatorHint?: string; body?: string } = {}) {
  const body = options.body ?? "not-json-yet";
  const timestamp = `${Date.now()}`;
  const credentialId = options.id ?? id;
  const pathname = "/api/internal/streamerbot/quotes";
  const signature = options.legacy ? buildSignature({ secret: settings.STREAMERBOT_SHARED_SECRET, timestamp, body })
    : buildCredentialSignature({ credentialId, secret, timestamp, body, method: "POST", pathname });
  return new Request(`https://other-streamer.ludylops.live${pathname}`, {
    method: "POST", body, headers: { "x-timestamp": timestamp, "x-signature": signature, "x-creator-slug": options.creatorHint ?? "someone-else", ...(options.legacy ? {} : { "x-streamerbot-credential-id": credentialId }) },
  });
}
function record(status = "active", creatorId = "creator-a", retiringUntil: Date | null = null) {
  return { id, creatorId, status, retiringUntil, revokedAt: null, createdAt: new Date(), lastUsedAt: null,
    encryptedSecret: encryptCredentialSecret(secret, id, creatorId, settings.STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY) };
}
describe("Streamer.bot authentication boundary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    settings.STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    settings.STREAMERBOT_LEGACY_AUTH_ENABLED = "true";
    store.find.mockReset().mockResolvedValue(record());
    store.enabled.mockReset().mockResolvedValue(true);
    store.used.mockReset().mockResolvedValue(undefined);
  });
  it("authenticates raw body exactly once and ignores unsigned tenant selectors", async () => {
    const req = request();
    const read = vi.spyOn(req, "text");
    const result = await authenticateStreamerbotRequest(req);
    expect(result).toMatchObject({ ok: true, raw: "not-json-yet", creatorId: "creator-a", credentialId: id });
    expect(read).toHaveBeenCalledTimes(1);
    expect(store.enabled).toHaveBeenCalledWith("creator-a");
    expect(store.used).toHaveBeenCalledWith(id, expect.any(Date));
    if (result.ok) expect((await authorizeStreamerbotOperation(result, "quotes.legacy"))?.status).toBe(403);
  });
  it("does not expose secrets or payloads in authentication logs", async () => {
    await authenticateStreamerbotRequest(request());
    const logged = JSON.stringify(vi.mocked(console.info).mock.calls);
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain("not-json-yet");
    expect(logged).not.toContain(settings.STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY);
  });
  it.each(["revoked", "unknown"])("rejects %s credentials", async (status) => {
    store.find.mockResolvedValue(record(status));
    const result = await authenticateStreamerbotRequest(request());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    expect(store.enabled).not.toHaveBeenCalled();
  });
  it("accepts active and unexpired retiring credentials; rejects expired overlap", async () => {
    store.find.mockResolvedValue(record("retiring", "creator-a", new Date(Date.now() + 60000)));
    expect((await authenticateStreamerbotRequest(request())).ok).toBe(true);
    store.find.mockResolvedValue(record("retiring", "creator-a", new Date(Date.now() - 1)));
    expect((await authenticateStreamerbotRequest(request())).ok).toBe(false);
  });
  it("never retries legacy authentication for an unknown or malformed credential ID", async () => {
    store.find.mockResolvedValue(null);
    const req = request({ legacy: true });
    req.headers.set("x-streamerbot-credential-id", id);
    expect((await authenticateStreamerbotRequest(req)).ok).toBe(false);
    req.headers.set("x-streamerbot-credential-id", "");
    expect((await authenticateStreamerbotRequest(request({ id: "bad" }))).ok).toBe(false);
  });
  it("rejects a swapped credential ID even when the verification secret is identical", async () => {
    const otherId = `sbc_${"b".repeat(32)}`;
    store.find.mockResolvedValue({ ...record(), id: otherId, encryptedSecret: encryptCredentialSecret(secret, otherId, "creator-a", settings.STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY) });
    const req = request(); req.headers.set("x-streamerbot-credential-id", otherId);
    expect((await authenticateStreamerbotRequest(req)).ok).toBe(false);
  });
  it("denies inactive creators/modules before auditing or side effects", async () => {
    store.enabled.mockResolvedValue(false);
    const result = await authenticateStreamerbotRequest(request());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
    expect(store.used).not.toHaveBeenCalled();
  });
  it("legacy mode is fixed to the default creator and can be disabled", async () => {
    const result = await authenticateStreamerbotRequest(request({ legacy: true }));
    expect(result).toMatchObject({ ok: true, creatorId: DEFAULT_CREATOR_ID, credentialId: null, mode: "legacy" });
    expect(store.find).not.toHaveBeenCalled();
    expect(store.enabled).toHaveBeenCalledWith(DEFAULT_CREATOR_ID);
    settings.STREAMERBOT_LEGACY_AUTH_ENABLED = "false";
    expect((await authenticateStreamerbotRequest(request({ legacy: true }))).ok).toBe(false);
  });
  it("fails closed with sanitized errors on storage/decryption faults", async () => {
    store.find.mockRejectedValue(new Error(`query with ${secret}`));
    const result = await authenticateStreamerbotRequest(request());
    if (result.ok) throw new Error("unexpected success");
    expect(result.response.status).toBe(503);
    expect(await result.response.text()).not.toContain(secret);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(secret);
  });
});
