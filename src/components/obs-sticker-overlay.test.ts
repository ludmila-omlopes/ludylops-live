// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const navigation = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query) }));
import { ObsStickerOverlay } from "./obs-sticker-overlay";
import type { StickerAlert } from "@/lib/youtube-stickers";

let root: Root, container: HTMLDivElement;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
const alert = (n: number): StickerAlert => ({ id: n.toString(16).padStart(64, "0"), receivedAt: "2026-10-06T12:00:00.000Z", displayName: `Pessoa ${n}`, amount: "R$ 10,00", stickerAltText: `Sticker ${n}`, stickerImageUrl: "https://yt3.ggpht.com/original.webp" });
const batch = (alerts: StickerAlert[], n = 2) => Response.json({ ok: true, data: { alerts, cursor: `${alert(n).receivedAt}|${alert(n).id}` } });
const mount = async (creatorSlug = "ludylops") => { await act(async () => root.render(createElement(ObsStickerOverlay, { creatorSlug }))); };
const advance = async (ms: number) => { await act(async () => vi.advanceTimersByTimeAsync(ms)); };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-06T12:00:10Z")); navigation.query = "";
  sessionStorage.clear(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => batch([])).mockResolvedValueOnce(batch([alert(1), alert(2)]));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Super Sticker overlay", () => {
  it("renders the original URL, plays FIFO for 8 seconds each and sends the cursor", async () => {
    await mount(); expect(container.textContent).toContain("Pessoa 1");
    expect(container.querySelector("img")?.getAttribute("src")).toBe(alert(1).stickerImageUrl);
    await advance(7999); expect(container.textContent).toContain("Pessoa 1");
    await advance(1); expect(container.textContent).toContain("Pessoa 2");
    await advance(8000); expect(container.textContent).toBe("");
    expect(String(fetchMock.mock.calls[1][0])).toContain("cursor=");
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes("creator=ludylops"))).toBe(true);
  });
  it("does not replay the displayed item on reload and resumes pending items", async () => {
    await mount(); await act(async () => root.unmount()); root = createRoot(container);
    await mount(); expect(container.textContent).toContain("Pessoa 2");
    expect(container.textContent).not.toContain("Pessoa 1");
  });
  it("shows descriptive text after an image failure, without replacing the original asset", async () => {
    await mount(); await act(async () => container.querySelector("img")!.dispatchEvent(new Event("error")));
    expect(container.querySelector("img")).toBeNull(); expect(container.textContent).toContain("Sticker 1");
  });
  it("clears alerts when module access is denied", async () => {
    await mount(); fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    await advance(2000); expect(container.textContent).toBe("");
    await advance(10_000); expect(container.textContent).toBe("");
  });
  it("does not overlap slow requests and aborts on unmount", async () => {
    fetchMock.mockReset().mockImplementation(() => new Promise(() => {}));
    await mount(); await advance(30_000); expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount()); root = createRoot(container);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it("isolates queues when the creator changes", async () => {
    await mount(); await mount("outro"); expect(container.textContent).toBe("");
    expect(String(fetchMock.mock.calls.at(-1)![0])).toContain("creator=outro");
    await advance(10_000); expect(container.textContent).toBe("");
  });
  it("previews layout without fake YouTube assets or network calls", async () => {
    navigation.query = "demo=1"; await mount(); await advance(30_000);
    expect(container.textContent).toContain("Teste de Super Sticker"); expect(fetchMock).not.toHaveBeenCalled();
  });
});
