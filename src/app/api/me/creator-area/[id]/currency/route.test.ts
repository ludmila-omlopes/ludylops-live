import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ session: vi.fn(), db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: true }));
vi.mock("@/lib/api", async () => ({
  requireApiSession: state.session,
  ...(await vi.importActual("@/lib/request-origin")),
}));
import { GET, PATCH } from "./route";
import { createCreatorArea } from "@/lib/creators/service";
import { getOwnedCurrency } from "@/lib/creators/currency.server";

const base = "http://localhost:3000";
const context = (id: string) => ({ params: Promise.resolve({ id }) });
function request(id: string, body: unknown = { currencyLabel: "cristais" }, origin: string | null = base) {
  return new Request(`${base}/api/me/creator-area/${id}/currency`, {
    method: "PATCH", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  globalThis.__creatorTenantStore = [];
  state.db.mockReset().mockReturnValue(null);
  state.session.mockReset().mockResolvedValue({ user: { activeViewerId: "owner-a", email: "a@example.com" } });
});

describe("owner currency endpoint", () => {
  it("persists only the selected owner's currency and marks responses no-store", async () => {
    const a = await createCreatorArea("owner-a", { displayName: "Canal A" });
    const b = await createCreatorArea("owner-b", { displayName: "Canal B" });
    const response = await PATCH(request(a.creator.id), context(a.creator.id));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const read = await GET(new Request(base), context(a.creator.id));
    expect(await read.json()).toEqual({ ok: true, data: { currencyLabel: "cristais" } });
    expect(await getOwnedCurrency("owner-b", b.creator.id)).toEqual({ currencyLabel: "pontos" });
    expect((await PATCH(request(b.creator.id), context(b.creator.id))).status).toBe(404);
    expect((await GET(new Request(base), context(b.creator.id))).status).toBe(404);
  });
  it("requires an active viewer session for both methods", async () => {
    state.session.mockResolvedValue(null);
    expect((await GET(new Request(base), context("id"))).status).toBe(401);
    expect((await PATCH(request("id"), context("id"))).status).toBe(401);
  });
  it.each([null, "https://attacker.example"])("rejects mutation origin %s before session/database access", async (origin) => {
    expect((await PATCH(request("id", {}, origin), context("id"))).status).toBe(403);
    expect(state.session).not.toHaveBeenCalled();
    expect(state.db).not.toHaveBeenCalled();
  });
  it.each([null, {}, { currencyLabel: "" }, { currencyLabel: "a".repeat(33) },
    { currencyLabel: "gemas", ownerUserId: "owner-a" }, { currencyLabel: "gemas", creatorId: "other" }])("rejects invalid or forged input %s", async (body) => {
    const a = await createCreatorArea("owner-a", { displayName: "Canal A" });
    expect((await PATCH(request(a.creator.id, body), context(a.creator.id))).status).toBe(400);
    expect(await getOwnedCurrency("owner-a", a.creator.id)).toEqual({ currencyLabel: "pontos" });
  });
  it("returns a controlled error for malformed JSON", async () => {
    const req = new Request(base, { method: "PATCH", headers: { origin: base }, body: "{" });
    expect((await PATCH(req, context("id"))).status).toBe(400);
  });
  it("does not reveal session/storage errors", async () => {
    state.session.mockRejectedValue(new Error("PRIVATE database detail"));
    const response = await GET(new Request(base), context("id"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE");
  });
});
