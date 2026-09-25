import { EventEmitter } from "node:events";
import type { RequestOptions } from "node:https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ dns: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.dns }));
vi.mock("node:https", () => ({ request: mocks.request }));
import { lookupRecommendationImage as lookup, limitedRecommendationImage as limited, publicIpv4 } from "./recommendation-image.server";
type Fixture = { status?: number; headers?: Record<string, string>; chunks?: string[]; hang?: boolean };
let fixtures: Fixture[];
const html = '<meta property="og:image" content="https://m.media-amazon.com/product.jpg">';
beforeEach(() => {
  fixtures = [{ chunks: [html] }]; mocks.dns.mockReset().mockResolvedValue([{ address: "8.8.8.8", family: 4 }]); mocks.request.mockReset();
  mocks.request.mockImplementation((options: RequestOptions, callback: (response: unknown) => void) => {
    const fixture = fixtures.shift() ?? { chunks: [html] };
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => {
      if (fixture.hang) return;
      const response = Object.assign(new EventEmitter(), { statusCode: fixture.status ?? 200, headers: { "content-type": "text/html; charset=utf-8", ...fixture.headers }, destroyed: false,
        destroy() { this.destroyed = true; } });
      queueMicrotask(() => {
        callback(response);
        for (const chunk of fixture.chunks ?? []) if (!response.destroyed) response.emit("data", Buffer.from(chunk));
        if (!response.destroyed) response.emit("end");
      });
    };
    return req;
  });
});
afterEach(() => { vi.useRealTimers(); });
describe("bounded product image requests", () => {
  it("pins the validated IP while preserving TLS identity and sends no caller credentials", async () => {
    expect(await lookup("https://www.amazon.com.br/dp/item?tag=creator")).toEqual({ imageUrl: "https://m.media-amazon.com/product.jpg" });
    expect(mocks.request.mock.calls[0][0]).toMatchObject({ hostname: "8.8.8.8", servername: "www.amazon.com.br", port: 443, agent: false, path: "/dp/item?tag=creator", headers: { Host: "www.amazon.com.br", "Accept-Encoding": "identity" } });
    expect(mocks.request.mock.calls[0][0].headers).not.toHaveProperty("Cookie");
    expect(mocks.request.mock.calls[0][0]).not.toHaveProperty("rejectUnauthorized", false);
  });
  it("rejects unapproved hosts before DNS and private/reserved DNS answers before connecting", async () => {
    await expect(lookup("https://evil.test")).rejects.toThrow("unsupported"); expect(mocks.dns).not.toHaveBeenCalled();
    for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.1.1", "172.31.1.1", "100.64.0.1", "0.0.0.0", "198.18.1.1", "192.0.2.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "::1", "::ffff:127.0.0.1"]) {
      expect(publicIpv4(ip)).toBe(false); mocks.dns.mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }, { address: ip, family: 4 }]);
      await expect(lookup("https://www.amazon.com.br/item")).rejects.toThrow("unavailable");
    }
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("validates every redirect and stops loops after four requests", async () => {
    fixtures = [{ status: 302, headers: { location: "https://www.amazon.com.br/dp/item" } }, { chunks: [html] }];
    expect(await lookup("https://amzn.to/item")).toHaveProperty("imageUrl"); expect(mocks.dns).toHaveBeenCalledTimes(2);
    for (const location of ["http://www.amazon.com.br/item", "https://127.0.0.1/item", "https://evil.test/item"]) {
      fixtures = [{ status: 302, headers: { location } }];
      await expect(lookup("https://amzn.to/item")).rejects.toThrow("unsupported");
    }
    mocks.request.mockClear(); fixtures = Array.from({ length: 4 }, () => ({ status: 302, headers: { location: "/loop" } }));
    await expect(lookup("https://www.amazon.com.br/item")).rejects.toThrow("unavailable"); expect(mocks.request).toHaveBeenCalledTimes(4);
  });
  it("bounds response bytes and rejects blocked, compressed, non-HTML or missing metadata responses", async () => {
    const invalid: Fixture[] = [{ status: 403 }, { headers: { "content-type": "application/json" } }, { headers: { "content-encoding": "gzip" } }];
    for (const fixture of invalid) {
      fixtures = [fixture]; await expect(lookup("https://www.amazon.com.br/item")).rejects.toThrow("unavailable");
    }
    fixtures = [{ chunks: ["<html>No image</html>"] }]; await expect(lookup("https://www.amazon.com.br/item")).rejects.toThrow("no_image");
  });
  it("stops large downloads after the first MiB, using only complete metadata from that prefix", async () => {
    fixtures = [{ chunks: [html, "x".repeat(1024 * 1024), '<meta property="og:image" content="/late.jpg">'] }];
    expect(await lookup("https://www.amazon.com.br/item")).toEqual({ imageUrl: "https://m.media-amazon.com/product.jpg" });
    fixtures = [{ chunks: ["x".repeat(1024 * 1024), html] }];
    await expect(lookup("https://www.amazon.com.br/item")).rejects.toThrow("no_image");
  });
  it("times out stalled responses and stalled DNS, and aborts a live connection", async () => {
    vi.useFakeTimers(); fixtures = [{ hang: true }];
    const first = expect(lookup("https://www.amazon.com.br/item")).rejects.toThrow("unavailable");
    await vi.advanceTimersByTimeAsync(8000); await first;
    expect(mocks.request.mock.calls[0][0].signal.aborted).toBe(true);
    mocks.dns.mockImplementationOnce(() => new Promise(() => {}));
    const second = expect(lookup("https://www.amazon.com.br/item")).rejects.toThrow("unavailable");
    await vi.advanceTimersByTimeAsync(8000); await second;
  });
  it("limits repeated and simultaneous requests for the same authenticated owner", async () => {
    const key = `owner-${Math.random()}`;
    for (let i = 0; i < 10; i++) await limited(key, "https://www.amazon.com.br/item");
    await expect(limited(key, "https://www.amazon.com.br/item")).rejects.toThrow("rate_limit");
    vi.useFakeTimers(); fixtures = [{ hang: true }];
    const pending = expect(limited("busy-owner", "https://www.amazon.com.br/item")).rejects.toThrow("unavailable");
    await expect(limited("busy-owner", "https://www.amazon.com.br/item")).rejects.toThrow("rate_limit");
    await vi.advanceTimersByTimeAsync(8000); await pending;
  });
});
