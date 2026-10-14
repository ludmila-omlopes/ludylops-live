// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query) }));
import { ObsSubscriberOverlay } from "./obs-subscriber-overlay";

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json({
    ok: true,
    data: url.includes("live-status") ? { isLive: true } : [{
      eventId: "subscription-1", displayName: "Pessoa inscrita", viewerExternalId: "UC-test",
      youtubeHandle: null, occurredAt: new Date().toISOString(), broadcastId: "live-1",
    }],
  })));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("subscriber alert duration", () => {
  it.each([
    ["", 7000], ["duration=", 7000], ["duration=%20", 7000],
    ["duration=invalid", 7000], ["duration=Infinity", 7000],
    ["duration=10000", 10000], ["durationMs=5000&duration=9000", 5000],
    ["duration=0", 3000], ["duration=99999", 20000],
  ])("keeps the alert visible for the expected time (%s)", async (query, duration) => {
    navigation.query = query;
    await act(async () => root.render(createElement(ObsSubscriberOverlay)));
    expect(container.textContent).toContain("Pessoa inscrita");
    await act(async () => vi.advanceTimersByTimeAsync(duration - 1));
    expect(container.textContent).toContain("Pessoa inscrita");
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(container.textContent).not.toContain("Pessoa inscrita");
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(container.textContent).not.toContain("Pessoa inscrita");
  });
});
