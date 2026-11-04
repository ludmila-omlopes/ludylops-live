// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const navigation = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query) }));
import { ObsGiftOverlay } from "./obs-gift-overlay";
import type { GiftAlert } from "@/lib/youtube-gifts";

let root: Root, container: HTMLDivElement;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
const gift = (n: number, patch: Partial<GiftAlert> = {}): GiftAlert => ({ id: n.toString(16).padStart(64, "0"), receivedAt: "2026-11-04T12:00:00.000Z",
  displayName: "Ana", giftName: "Estrela", giftImageUrl: "https://www.gstatic.com/youtube/img/pdg/gift/assets/star.png", jewelsAmount: 10, comboCount: 1, ...patch });
const batch = (alerts: GiftAlert[], n = 9) => Response.json({ ok: true, data: { alerts, cursor: `${gift(n).receivedAt}|${gift(n).id}` } });
const mount = async () => { await act(async () => root.render(createElement(ObsGiftOverlay, { creatorSlug: "ludylops" }))); };
const advance = async (ms: number) => { await act(async () => vi.advanceTimersByTimeAsync(ms)); };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-04T12:00:10Z")); navigation.query = "";
  sessionStorage.clear(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => batch([]));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Jewel gift overlay", () => {
  it("shows the gift image, sender and jewels for 6 seconds by default", async () => {
    fetchMock.mockResolvedValueOnce(batch([gift(1)]));
    await mount();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(gift(1).giftImageUrl);
    expect(container.textContent).toContain("Ana"); expect(container.textContent).toContain("Estrela · 10 joias");
    expect(container.textContent).not.toContain("×");
    await advance(6000); expect(container.textContent).toBe("");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/obs/gifts/current?creator=ludylops");
  });
  it("folds a combo into one alert and restarts its timer", async () => {
    fetchMock.mockResolvedValueOnce(batch([gift(1), gift(2, { comboCount: 2 }), gift(3, { displayName: "Bia", giftName: "F no chat" })]));
    await mount();
    expect(container.textContent).toContain("×2"); expect(container.textContent).toContain("20 joias");
    fetchMock.mockResolvedValueOnce(batch([gift(4, { displayName: "Bia", giftName: "F no chat", comboCount: 2 })]));
    await advance(2000); expect(container.textContent).toContain("Ana");
    await advance(4000); expect(container.textContent).toContain("Bia"); expect(container.textContent).toContain("×2");
  });
  it("extends the alert on screen when the combo keeps going", async () => {
    fetchMock.mockResolvedValueOnce(batch([gift(1)])).mockResolvedValueOnce(batch([gift(2, { comboCount: 2 })]));
    await mount(); await advance(2000);
    expect(container.textContent).toContain("×2");
    await advance(5000); expect(container.textContent).toContain("Ana");
    await advance(1000); expect(container.textContent).toBe("");
  });
  it("falls back to the gift name when the image fails", async () => {
    fetchMock.mockResolvedValueOnce(batch([gift(1)]));
    await mount(); await act(async () => container.querySelector("img")!.dispatchEvent(new Event("error")));
    expect(container.querySelector("img")).toBeNull(); expect(container.textContent).toContain("Estrela");
  });
  it("previews layout without network calls", async () => {
    navigation.query = "demo=1"; await mount(); await advance(30_000);
    expect(container.textContent).toContain("Teste de presente"); expect(fetchMock).not.toHaveBeenCalled();
  });
});
