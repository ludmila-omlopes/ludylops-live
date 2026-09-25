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
import { GET, PATCH } from "./route";
import { POST as integration } from "@/app/api/internal/streamerbot/chat-rewards/route";
import { getOwnedChatRewards, updateOwnedChatRewards } from "@/lib/creators/chat-rewards-settings.server";
import { readOwnedChannelEconomy } from "@/lib/creators/economy";

let id: string, otherId: string;
const rule = { enabled: true, amount: 8, cooldownSeconds: 60 };
const message = { viewerExternalId: "UCabcdefghijklmnopqrstuv", broadcastId: "abcdefghijk", messageId: "native-message-1" };
const context = () => ({ params: Promise.resolve({ id }) });
const request = (body: unknown = rule, origin = "https://app.test") => new Request(`https://app.test/api/me/creator-area/${id}/chat-rewards`,
  { method: "PATCH", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(async () => {
  state.viewer = "owner"; state.auth.mockReset(); globalThis.__creatorTenantStore = [];
  globalThis.__creatorEconomyDemo = undefined; globalThis.__lojaDemoStore = undefined;
  await getViewerPoints("initialize");
  id = (await createCreatorArea("owner", { displayName: "Canal A" })).creator.id;
  otherId = (await createCreatorArea("other", { displayName: "Canal B" })).creator.id;
});
describe("chat reward adapters", () => {
  it("protects owner settings with session, origin and ownership", async () => {
    expect((await PATCH(request(rule, "https://attacker.test"), context())).status).toBe(403);
    state.viewer = ""; expect((await PATCH(request(), context())).status).toBe(401);
    expect((await GET(request(), context())).status).toBe(401);
    state.viewer = "other"; expect((await PATCH(request(), context())).status).toBe(404);
    expect((await GET(request(), context())).status).toBe(404);
    state.viewer = "owner"; expect((await PATCH(request(), context())).status).toBe(200);
    const response = await GET(request(), context());
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).data).toEqual(rule);
    expect((await getOwnedChatRewards("other", otherId)).enabled).toBe(false);
  });
  it.each([{ ...rule, creatorId: "other" }, { ...rule, amount: -1 }, { ...rule, cooldownSeconds: 0 }, null])("rejects forged or invalid settings %s", async (input) => {
    expect((await PATCH(request(input), context())).status).toBe(400);
    expect((await getOwnedChatRewards("owner", id)).enabled).toBe(false);
  });
  it("rewards only the authenticated community using server settings and no legacy balance initialization", async () => {
    await updateOwnedChatRewards("other", otherId, rule);
    state.auth.mockResolvedValue({ ok: true, creatorId: otherId, mode: "credential", raw: JSON.stringify(message) });
    const response = await integration(request());
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).data).toMatchObject({ outcome: "credited", entry: { amount: 8 } });
    expect((await (await integration(request())).json()).data.duplicate).toBe(true);
    expect((await readOwnedChannelEconomy({ creatorId: otherId }, "other", message.viewerExternalId)).balance.currentBalance).toBe(8);
    expect((await readOwnedChannelEconomy({ creatorId: id }, "owner", message.viewerExternalId)).balance.currentBalance).toBe(0);
  });
  it.each([{ ...message, amount: 999 }, { ...message, creatorId: "other" }, { ...message, viewerId: "other" },
    { ...message, broadcastId: "" }, { ...message, messageId: "" }, { ...message, viewerExternalId: "@handle" }])("rejects injected reward fields before identity creation %s", async (body) => {
    const before = globalThis.__lojaDemoStore!.viewers.length;
    state.auth.mockResolvedValue({ ok: true, creatorId: id, mode: "credential", raw: JSON.stringify(body) });
    expect((await integration(request())).status).toBe(400);
    expect(globalThis.__lojaDemoStore!.viewers).toHaveLength(before);
  });
  it("rejects invalid authentication, legacy, disabled modules and archived creators", async () => {
    state.auth.mockResolvedValue({ ok: false, response: Response.json({ ok: false }, { status: 401 }) });
    expect((await integration(request())).status).toBe(401);
    state.auth.mockResolvedValue({ ok: true, creatorId: "creator_ludylops", mode: "legacy", raw: JSON.stringify(message) });
    expect((await integration(request())).status).toBe(403);
    state.auth.mockResolvedValue({ ok: true, creatorId: id, mode: "credential", raw: JSON.stringify(message) });
    const tenant = globalThis.__creatorTenantStore![0];
    tenant.modules.find((m) => m.moduleKey === "streamerbot")!.status = "disabled";
    expect((await integration(request())).status).toBe(403);
    tenant.creator.status = "archived";
    expect((await integration(request())).status).toBe(403);
  });
});
