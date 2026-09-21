import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), dashboard: vi.fn(), pricing: vi.fn(), effect: vi.fn(), style: vi.fn(), live: vi.fn(), headers: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, isProduction: true, adminEmails: new Set(["admin@example.com"]), platformOwnerEmails: new Set(), env: { APP_URL: "https://ludylops.live" } }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not_found"); }, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/db/repository", () => ({ listQuotes: mocks.list, getViewerDashboard: mocks.dashboard, getPipetzPricing: mocks.pricing, processNextQueuedQuoteOverlay: mocks.effect, showQuoteOverlayForViewer: mocks.effect, getObsOverlayAdminStatus: mocks.effect, setObsOverlayPaused: mocks.effect, cancelQueuedQuoteOverlays: mocks.effect }));
vi.mock("@/lib/obs-overlay-settings", () => ({ updateObsOverlayStyleConfig: mocks.style }));
vi.mock("@/lib/streamerbot/live-status", () => ({ getStreamerbotLivestreamStatus: mocks.live }));

import { defaultCreatorTenant } from "@/lib/creators/tenant";
import { resolveQuoteRequest } from "@/lib/creators/quote-context";
import { resolveQuotePage } from "@/lib/creators/quote-page-context";
import { CreatorQuotes } from "@/components/creator-quotes";
import { GET as current } from "@/app/api/obs/quotes/current/route";
import { GET as live } from "@/app/api/obs/live-status/route";
import { POST as show } from "@/app/api/me/quotes/[quoteId]/show/route";
import { GET as adminGet, POST as adminPost } from "@/app/api/admin/obs-overlays/route";
import type { CreatorTenantRecord } from "@/lib/types";

function tenant(slug: string): CreatorTenantRecord {
  return { ...structuredClone(defaultCreatorTenant), creator: { ...defaultCreatorTenant.creator, id: `creator_${slug}`, slug, displayName: slug, ownerUserId: `owner_${slug}` }, domains: [{ ...defaultCreatorTenant.domains[0], id: `domain_${slug}`, creatorId: `creator_${slug}`, hostname: `${slug}.ludylops.live` }] };
}
function request(query = "", host = "ludylops.live", body?: unknown) {
  return new Request(`https://${host}/api/quotes${query}`, { method: body ? "POST" : "GET", headers: { host, origin: `https://${host}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

describe("quote request boundaries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.__creatorTenantStore = [tenant("alice"), tenant("bob")];
    mocks.headers.mockResolvedValue(new Headers({ host: "ludylops.live" }));
    mocks.auth.mockResolvedValue({ user: { email: "alice@example.com", activeViewerId: "owner_alice", isLinked: true } });
    mocks.list.mockResolvedValue([]);
  });

  it("resolves path/query/registered hosts and preserves creator through server-page requests", async () => {
    expect((await resolveQuoteRequest(request("?creator=alice")))?.creator.id).toBe("creator_alice");
    expect((await resolveQuoteRequest(request("", "bob.ludylops.live")))?.creator.id).toBe("creator_bob");
    expect((await resolveQuotePage({}, "alice"))?.creator.id).toBe("creator_alice");
    expect(await resolveQuotePage({ creator: "bob" }, "alice")).toBeNull();
  });

  it.each([
    ["?creator=missing", "ludylops.live"], ["?creator=alice&creator=bob", "ludylops.live"],
    ["?creator=alice", "bob.ludylops.live"], ["?creator=ludylops", "unknown.example.com"], ["?creator=", "ludylops.live"],
  ])("rejects invalid or conflicting routing input %s on %s", async (query, host) => {
    expect(await resolveQuoteRequest(request(query, host))).toBeNull();
    const response = await current(request(query, host));
    expect(response.status).toBe(404); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.effect).not.toHaveBeenCalled();
  });

  it("rejects inactive creators and disabled quote modules", async () => {
    globalThis.__creatorTenantStore![0].creator.status = "disabled";
    globalThis.__creatorTenantStore![1].modules = [];
    for (const slug of ["alice", "bob"]) expect(await resolveQuoteRequest(request(`?creator=${slug}`))).toBeNull();
  });

  it("renders another creator's quotes without global dashboard, pricing, auth or overlay actions", async () => {
    const html = renderToStaticMarkup(await CreatorQuotes({ context: { creatorId: "creator_alice" }, creatorSlug: "alice" }));
    expect(mocks.list).toHaveBeenCalledWith({ creatorId: "creator_alice" });
    expect(html).toContain("ainda não estão disponíveis");
    for (const fn of [mocks.dashboard, mocks.pricing, mocks.auth, mocks.effect, mocks.style, mocks.live]) expect(fn).not.toHaveBeenCalled();
  });

  it("blocks paid viewer/OBS/live requests before global services for both creators", async () => {
    for (const slug of ["alice", "bob"]) {
      expect((await show(request(`?creator=${slug}`, "ludylops.live", {}), { params: Promise.resolve({ quoteId: "1" }) })).status).toBe(403);
      expect((await current(request(`?creator=${slug}`))).status).toBe(403);
      expect((await live(request(`?creator=${slug}`))).status).toBe(404);
    }
    expect(mocks.effect).not.toHaveBeenCalled(); expect(mocks.live).not.toHaveBeenCalled();
  });

  it("does not turn creator A's ownership into global admin rights over B or the default creator", async () => {
    for (const slug of ["bob", "ludylops"]) {
      expect((await adminGet(request(`?creator=${slug}`))).status).toBe(403);
      expect((await adminPost(request(`?creator=${slug}`, "ludylops.live", { action: "set_style", style: "obscur" }))).status).toBe(403);
    }
    expect(mocks.effect).not.toHaveBeenCalled(); expect(mocks.style).not.toHaveBeenCalled();
  });

  it("keeps global admins limited to default overlay controls and preserves no-store polling", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "admin@example.com" } });
    expect((await adminPost(request("?creator=bob", "ludylops.live", { action: "pause" }))).status).toBe(403);
    expect(mocks.effect).not.toHaveBeenCalled();
    mocks.effect.mockResolvedValue(null);
    expect((await adminGet(request())).status).toBe(200);
    const response = await current(request());
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.effect).toHaveBeenLastCalledWith({ creatorId: "creator_ludylops" });
  });
});
