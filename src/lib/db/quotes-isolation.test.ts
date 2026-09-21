import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ demo: true, db: vi.fn(), live: vi.fn(), style: vi.fn() }));
vi.mock("@/lib/env", () => ({ get isDemoMode() { return state.demo; }, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/streamerbot/live-status", () => ({ requireActiveLivestream: state.live }));
vi.mock("@/lib/obs-overlay-settings", () => ({ getObsOverlayStyleConfig: state.style }));
import { cancelQueuedQuoteOverlays, getActiveQuoteOverlay, getObsOverlayControlRecord, listQuotes, processNextQueuedQuoteOverlay, runQuoteCommandFromChat, setObsOverlayPaused, showQuoteOverlayForViewer } from "./repository";
import { defaultCreatorContext, type CreatorContext } from "@/lib/creators/context";

const a = { creatorId: "creator_a" }, b = { creatorId: "creator_b" };
describe("quotes isolation", () => {
  beforeEach(() => { globalThis.__lojaDemoStore = undefined; state.demo = true; state.db.mockReset().mockReturnValue(null); state.live.mockReset(); state.style.mockReset(); });

  it("allocates independent numbers, scopes numbered/random/list reads, and never bootstraps global balances for other creators", async () => {
    await listQuotes(defaultCreatorContext);
    const balances = structuredClone(globalThis.__lojaDemoStore!.balances);
    for (const [context, text] of [[a, "Frase A"], [b, "Frase B"]] as const) {
      const result = await runQuoteCommandFromChat(context, { action: "create", viewerExternalId: context.creatorId, quoteText: text, source: "test" });
      expect(result.quote).toMatchObject({ creatorId: context.creatorId, quoteNumber: 1, body: text });
      expect((await listQuotes(context)).map(row => row.body)).toEqual([text]);
      for (const quoteId of [1, undefined]) expect((await runQuoteCommandFromChat(context, { action: "get", quoteId, source: "test" })).quote.body).toBe(text);
    }
    expect(globalThis.__lojaDemoStore!.balances).toEqual(balances);
    await runQuoteCommandFromChat(a, { action: "create", viewerExternalId: a.creatorId, quoteText: "Segunda A", source: "test" });
    await expect(runQuoteCommandFromChat(b, { action: "get", quoteId: 2, source: "test" })).rejects.toThrow("quote_not_found");
    expect(await getActiveQuoteOverlay(b)).toBeNull();
    expect(await getObsOverlayControlRecord(a)).toMatchObject({ creatorId: a.creatorId, status: "active" });
    expect(await getObsOverlayControlRecord(b)).toMatchObject({ creatorId: b.creatorId, status: "active" });
  });

  it("rejects unavailable paid/display/refund/control paths before global dependencies or data mutations", async () => {
    await listQuotes(a);
    const before = structuredClone(globalThis.__lojaDemoStore);
    for (const operation of [
      () => runQuoteCommandFromChat(a, { action: "show", quoteId: 1, viewerExternalId: "unknown", source: "test" }),
      () => showQuoteOverlayForViewer(a, { quoteId: 1, viewerId: "unknown", source: "test" }),
      () => processNextQueuedQuoteOverlay(a),
      () => cancelQueuedQuoteOverlays(a, {}),
      () => setObsOverlayPaused(a, { paused: false }),
    ]) await expect(operation()).rejects.toThrow("operation_not_isolated");
    expect(globalThis.__lojaDemoStore).toEqual(before);
    expect(state.live).not.toHaveBeenCalled();expect(state.style).not.toHaveBeenCalled();
  });

  it("never falls back to demo after a real database failure or a missing required context", async () => {
    state.demo = false;
    await expect(listQuotes(a)).rejects.toThrow("database_unavailable");
    state.db.mockReturnValue({ select() { throw new Error("missing quote schema"); } });
    await expect(listQuotes(a)).rejects.toThrow("missing quote schema");
    await expect(listQuotes(undefined as unknown as CreatorContext)).rejects.toThrow("creator_context_required");
    expect(globalThis.__lojaDemoStore).toBeUndefined();
  });

  it("refunds a default demo queue failure without touching another creator's state", async () => {
    await listQuotes(a);
    const foreign = structuredClone(globalThis.__lojaDemoStore!.creatorQuotes);
    const store = globalThis.__lojaDemoStore!;
    const viewer = store.viewers[0];
    const balance = store.balances.find(entry => entry.viewerId === viewer.id)!;
    balance.currentBalance = 1000;
    await setObsOverlayPaused(defaultCreatorContext, { paused: true });
    const result = await showQuoteOverlayForViewer(defaultCreatorContext, { viewerId: viewer.id, quoteId: store.quotes[0].quoteNumber, source: "test" });
    expect(result.queued).not.toBeNull();
    expect(balance.currentBalance).toBeLessThan(1000);
    store.viewers = store.viewers.filter(entry => entry.id !== viewer.id);
    store.obsOverlayControl!.status = "active";
    await expect(processNextQueuedQuoteOverlay(defaultCreatorContext)).rejects.toThrow("viewer_not_ready");
    expect(balance.currentBalance).toBe(1000);
    expect(store.creatorQuotes).toEqual(foreign);
  });
});
