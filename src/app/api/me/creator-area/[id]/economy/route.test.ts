import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ viewer: "owner", auth: vi.fn() }));
vi.mock("@/lib/env", () => ({ isDemoMode: true, env: {}, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
vi.mock("@/lib/api", async () => {
  const origin = await import("@/lib/request-origin");
  return { requireApiSession: async () => state.viewer ? { user: { activeViewerId: state.viewer } } : null,
    isTrustedAppMutationRequest: origin.isTrustedAppMutationRequest };
});
vi.mock("@/lib/streamerbot/authenticate", async (original) => ({
  ...await original<typeof import("@/lib/streamerbot/authenticate")>(), authenticateStreamerbotRequest: state.auth,
}));
import { createCreatorArea } from "@/lib/creators/service";
import { getViewerPoints } from "@/lib/db/repository";
import { GET, POST } from "./route";
import { POST as integration } from "@/app/api/internal/streamerbot/economy/route";
import { POST as points } from "@/app/api/internal/streamerbot/points/route";
import { readOwnedChannelEconomy } from "@/lib/creators/economy";

let id: string, otherId: string;
const channel = "UCabcdefghijklmnopqrstuv";
const payload = { kind: "credit", viewerExternalId: channel, operationKey: "event-1", amount: 50, reason: "Live" };
const context = () => ({ params: Promise.resolve({ id }) });
const request = (input: unknown = payload, origin: string | null = "https://app.test") => new Request(`https://app.test/api/me/creator-area/${id}/economy`,
  { method: "POST", headers: { ...(origin ? { origin } : {}), "content-type": "application/json" }, body: JSON.stringify(input) });
beforeEach(async () => {
  state.viewer = "owner"; state.auth.mockReset(); globalThis.__creatorTenantStore = [];
  globalThis.__creatorEconomyDemo = undefined; globalThis.__lojaDemoStore = undefined;
  await getViewerPoints("initialize");
  id = (await createCreatorArea("owner", { displayName: "Canal A" })).creator.id;
  otherId = (await createCreatorArea("other-owner", { displayName: "Canal B" })).creator.id;
});
describe("owner and integration currency adapters", () => {
  it("enforces session, origin and ownership before any identity/data side effect", async () => {
    const before = globalThis.__lojaDemoStore!.viewers.length;
    expect((await POST(request(payload, null), context())).status).toBe(403);
    expect((await POST(request(payload, "https://attacker.test"), context())).status).toBe(403);
    state.viewer = ""; expect((await POST(request(), context())).status).toBe(401);
    state.viewer = "other-owner"; expect((await POST(request(), context())).status).toBe(403);
    expect(globalThis.__lojaDemoStore!.viewers).toHaveLength(before);
  });
  it("persists adjustments, supports retries and protects history from another owner", async () => {
    expect((await POST(request(), context())).status).toBe(200);
    const retry = await POST(request(), context()); expect((await retry.json()).data.duplicate).toBe(true);
    const url = `https://app.test/api/me/creator-area/${id}/economy?viewerExternalId=${channel}`;
    const response = await GET(new Request(url), context());
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).data.balance.currentBalance).toBe(50);
    state.viewer = "other-owner"; expect((await GET(new Request(url), context())).status).toBe(403);
  });
  it("rejects forged identities, negative quantities and malformed requests", async () => {
    expect((await POST(request({ ...payload, creatorId: otherId }), context())).status).toBe(400);
    expect((await POST(request({ ...payload, amount: -10 }), context())).status).toBe(400);
    expect((await POST(request(null), context())).status).toBe(400);
  });
  it("uses only verified credential identity and keeps legacy credentials out of new currency storage", async () => {
    state.auth.mockResolvedValue({ ok: true, creatorId: otherId, raw: JSON.stringify(payload), mode: "credential" });
    expect((await integration(request())).status).toBe(200);
    expect((await readOwnedChannelEconomy({ creatorId: otherId }, "other-owner", channel)).balance.currentBalance).toBe(50);
    expect((await readOwnedChannelEconomy({ creatorId: id }, "owner", channel)).balance.currentBalance).toBe(0);
    state.auth.mockResolvedValue({ ok: true, creatorId: "creator_ludylops", raw: JSON.stringify(payload), mode: "legacy" });
    expect((await integration(request())).status).toBe(403);
    state.auth.mockResolvedValue({ ok: false, response: Response.json({ ok: false }, { status: 401 }) });
    expect((await integration(request())).status).toBe(401);
  });
  it("rejects integration mutations when the creator or required module is disabled", async () => {
    state.auth.mockResolvedValue({ ok: true, creatorId: id, raw: JSON.stringify(payload), mode: "credential" });
    globalThis.__creatorTenantStore![0].modules.find((m) => m.moduleKey === "streamerbot")!.status = "disabled";
    expect((await integration(request())).status).toBe(403);
  });
  it("answers a balance command with the authenticated community currency", async () => {
    await POST(request(), context());
    state.auth.mockResolvedValue({ ok: true, creatorId: id, raw: JSON.stringify({ viewerExternalId: channel, youtubeDisplayName: "Lia" }), mode: "credential" });
    const response = await points(request());
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ balance: 50, currencyLabel: "pontos", replyMessage: "Lia, seu saldo atual é 50 pontos." });
  });
});
