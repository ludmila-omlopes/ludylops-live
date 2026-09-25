import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
// Next 16.2.9 still exports the testing helper under its previous name.
import { unstable_doesMiddlewareMatch as unstable_doesProxyMatch } from "next/experimental/testing/server";

const mocks = vi.hoisted(() => ({ authenticatedProxy: vi.fn() }));
vi.mock("@/auth", () => ({ auth: () => mocks.authenticatedProxy }));

import proxy, { config } from "./proxy";

const event = {} as NextFetchEvent;
describe("proxy composition", () => {
  beforeEach(() => mocks.authenticatedProxy.mockReset());

  it("rewrites the public root internally while preserving host, query and request headers", async () => {
    const request = new NextRequest("https://mari.ludylops.live/?ref=live", {
      headers: { host: "mari.ludylops.live", cookie: "test=value" },
    });
    const response = await proxy(request, event);
    expect(response?.headers.get("x-middleware-rewrite")).toBe("https://mari.ludylops.live/c/mari?ref=live");
    expect(response?.headers.get("location")).toBeNull();
    expect(response?.headers.get("set-cookie")).toBeNull();
    expect(request.headers.get("host")).toBe("mari.ludylops.live");
    expect(request.headers.get("cookie")).toBe("test=value");
    expect(mocks.authenticatedProxy).not.toHaveBeenCalled();
  });

  it.each(["ludylops.live", "www.ludylops.live", "admin.ludylops.live"])("passes through the root of %s without session work", async host => {
    const response = await proxy(new NextRequest(`http://${host}/`), event);
    expect(response?.headers.get("x-middleware-next")).toBe("1");
    expect(response?.headers.get("x-middleware-rewrite")).toBeNull();
    expect(mocks.authenticatedProxy).not.toHaveBeenCalled();
  });

  it.each(["/admin", "/admin/users", "/api/admin/users", "/owner", "/api/owner/creators", "/me", "/me/account"])("preserves Auth.js responses on %s", async pathname => {
    const request = new NextRequest(`https://mari.ludylops.live${pathname}`);
    const response = NextResponse.redirect("https://mari.ludylops.live/");
    response.cookies.set("session", "renewed");
    mocks.authenticatedProxy.mockResolvedValue(response);
    expect(await proxy(request, event)).toBe(response);
    expect(mocks.authenticatedProxy).toHaveBeenCalledExactlyOnceWith(request, event);
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url: request.url })).toBe(true);
  });

  it("matches the new public root", () => {
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url: "https://mari.ludylops.live/" })).toBe(true);
  });

  it.each(["localhost:3000", "ludylops-youtube-dashboard.vercel.app"])("opens the hub at %s without selecting a community", async host => {
    const response = await proxy(new NextRequest(`https://${host}/?ref=invite`), event);
    expect(response?.headers.get("x-middleware-rewrite")).toBe(`https://${host}/criar-area?ref=invite`);
    expect(response?.headers.get("location")).toBeNull();
    expect(mocks.authenticatedProxy).not.toHaveBeenCalled();
  });

  it("does not fall back to the hub when the forwarded host is invalid", async () => {
    const response = await proxy(new NextRequest("https://ludylops-youtube-dashboard.vercel.app/", { headers: { "x-forwarded-host": "invalid/path" } }), event);
    expect(response?.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it.each(["/c/mari", "/c/mari/", "/api/auth/callback/google", "/api/quotes", "/api/health", "/api/internal/streamerbot/quotes", "/_next/static/a.js", "/_next/image", "/favicon.ico", "/robots.txt", "/quotes", "/obs/quotes", "/administrator", "/ownership"])("excludes %s from proxy execution", pathname => {
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url: `https://mari.ludylops.live${pathname}` })).toBe(false);
  });
});
