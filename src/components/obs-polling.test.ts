// @vitest-environment jsdom
import { act, createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const navigation = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query) }));
import { ObsBetOverlay } from "./obs-bet-overlay";
import { ObsLikeGoalOverlay } from "./obs-like-goal-overlay";
import { ObsSubscriberOverlay } from "./obs-subscriber-overlay";
import { ObsWheelOverlay } from "./obs-wheel-overlay";
import { ObsQuoteOverlay } from "./obs-quote-overlay";

const fixtures = {
  bets: { id: "bet", question: "Live data", options: [], totalPool: 0, closesAt: "2099-01-01" },
  likes: { currentLikeCount: 10, goal: { label: "Live data", targetLikeCount: 50, rewardAmount: 20 }, progressPercent: 20 },
  subscribers: [{ eventId: "event-1", displayName: "Live data", occurredAt: new Date().toISOString() }],
  wheel: { title: "Live data", spinDurationMs: 5000, lastSpin: null, options: [{ id: "a", label: "A", isActive: true, weight: 1, color: "red" }, { id: "b", label: "B", isActive: true, weight: 1, color: "blue" }] },
};
const overlays = [["bets", ObsBetOverlay], ["likes", ObsLikeGoalOverlay], ["subscribers", ObsSubscriberOverlay], ["wheel", ObsWheelOverlay]] as const;
const json = (data: unknown) => Response.json({ ok: true, data });
let root: Root;
let container: HTMLDivElement;
let live: boolean;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
async function mount(component: ComponentType) { await act(async () => { root.render(createElement(component)); }); }
async function advance(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
const dataCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("/current"));
const statusCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("/live-status"));

beforeEach(() => {
  vi.useFakeTimers(); navigation.query = ""; live = false;
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  fetchMock = vi.fn<typeof fetch>(async url => {
    if (String(url).includes("live-status")) return json({ isLive: live });
    const key = String(url).match(/\/obs\/(\w+)\/current/)?.[1] as keyof typeof fixtures;
    return json(fixtures[key] ?? null);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe.each(overlays)("%s overlay polling", (name, Component) => {
  it("polls only status every 15 seconds while offline", async () => {
    await mount(Component); await advance(60_000);
    expect(statusCalls()).toHaveLength(5); expect(dataCalls()).toHaveLength(0);
    expect(container.textContent).toBe("");
  });
  it("starts immediately after live detection, polls at 1s and clears when offline", async () => {
    await mount(Component); live = true; await advance(15_000);
    expect(dataCalls()).toHaveLength(1);
    await advance(1_000); expect(dataCalls()).toHaveLength(2);
    live = false; await advance(14_000);
    const count = dataCalls().length;
    await advance(15_000); expect(dataCalls()).toHaveLength(count);
    expect(container.textContent).toBe("");
    live = true; await advance(15_000); expect(dataCalls().length).toBeGreaterThan(count);
  });
  it.each(["http", "network", "invalid"])("pauses on %s status failure", async failure => {
    live = true; await mount(Component);
    fetchMock.mockImplementation(async url => {
      if (String(url).includes("live-status")) {
        if (failure === "network") throw new Error("offline");
        if (failure === "http") return new Response(null, { status: 403 });
        return json({ isLive: "true" });
      }
      return json(fixtures[name]);
    });
    await advance(15_000); const count = dataCalls().length;
    await advance(15_000); expect(dataCalls()).toHaveLength(count);
    expect(container.textContent).toBe("");
  });
  it("does not overlap slow data requests or revive an offline overlay with late data", async () => {
    live = true;
    let resolveData!: (response: Response) => void;
    fetchMock.mockImplementation(async url => String(url).includes("live-status") ? json({ isLive: live }) : new Promise<Response>(resolve => { resolveData = resolve; }));
    await mount(Component); await advance(5_000); expect(dataCalls()).toHaveLength(1);
    live = false; await advance(10_000);
    expect(dataCalls()[0][1]?.signal?.aborted).toBe(true);
    await act(async () => resolveData(json(fixtures[name])));
    await advance(30_000);
    expect(dataCalls()).toHaveLength(1); expect(container.textContent).toBe("");
  });
  it("cancels timers and in-flight status requests on unmount", async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    await mount(Component); await advance(60_000); expect(statusCalls()).toHaveLength(1);
    await act(async () => root.unmount()); root = createRoot(container);
    expect(statusCalls()[0][1]?.signal?.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it("uses the same creator selector for status/data and waits for new context verification", async () => {
    navigation.query = "creator=ludylops"; live = true; await mount(Component);
    expect(dataCalls()[0][0]).toBe(`/api/obs/${name}/current?creator=ludylops`);
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    navigation.query = "creator=unknown&creator=second"; await mount(Component);
    expect(statusCalls().at(-1)?.[0]).toBe("/api/obs/live-status?creator=unknown&creator=second");
    expect(container.textContent).toBe("");
    await advance(30_000); expect(dataCalls()).toHaveLength(1);
  });
  it.each(["classic", "obscur"])("keeps %s demos visible without network polling", async style => {
    navigation.query = `demo=1&style=${style}`; await mount(Component);
    expect(container.textContent?.length).toBeGreaterThan(0);
    await advance(35_000); expect(fetchMock).not.toHaveBeenCalled();
  });
});

it("polls quotes at 1s with creator context while retaining its existing 5s live-status loop", async () => {
  live = true;
  await act(async () => root.render(createElement(ObsQuoteOverlay, { creatorSlug: "ludylops" })));
  expect(dataCalls()).toHaveLength(1);
  await advance(999); expect(dataCalls()).toHaveLength(1);
  await advance(1); expect(dataCalls()).toHaveLength(2);
  await advance(4_000); expect(statusCalls()).toHaveLength(2);
  expect(dataCalls().every(([url, options]) => url === "/api/obs/quotes/current?creator=ludylops" && options?.cache === "no-store")).toBe(true);
});
