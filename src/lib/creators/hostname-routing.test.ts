import { describe, expect, it } from "vitest";
import { getCreatorRootPath } from "./hostname-routing";
import { CREATOR_SLUG_RESERVED_WORDS } from "./identity";

function route(host: string, pathname = "/", forwarded?: string) {
  const headers = new Headers({ host });
  if (forwarded !== undefined) headers.set("x-forwarded-host", forwarded);
  return getCreatorRootPath(new Request(`http://localhost:3000${pathname}`, { headers }));
}

describe("creator wildcard root routing", () => {
  it.each([
    ["mari.ludylops.live", "/c/mari"],
    ["  MARI.LUDYLOPS.LIVE:443  ", "/c/mari"],
    ["mari-2.ludylops.live:3000", "/c/mari-2"],
    ["a.ludylops.live", "/c/a"],
    [`${"a".repeat(63)}.ludylops.live`, `/c/${"a".repeat(63)}`],
  ])("routes one valid DNS label: %s", (host, expected) => {
    expect(route(host)).toBe(expected);
  });

  it.each([
    "ludylops.live", "www.ludylops.live", "localhost:3000", "127.0.0.1:3000", "[::1]:3000",
    "mari.localhost", "mari.example.com", "mari.ludylops.live.evil.example", "a.b.ludylops.live",
    "-mari.ludylops.live", "mari-.ludylops.live", "ma_ri.ludylops.live", "mári.ludylops.live",
    "https://mari.ludylops.live", "mari.ludylops.live/", "user@mari.ludylops.live",
    "mari.ludylops.live?x", "mari.ludylops.live#x", "mari.ludylops.live:garbage",
    "mari.ludylops.live:99999", "mari.ludylops.live.", `${"a".repeat(64)}.ludylops.live`, "",
    ...Array.from(CREATOR_SLUG_RESERVED_WORDS, slug => `${slug}.ludylops.live`),
  ])("does not route an excluded/malformed host: %s", host => {
    expect(route(host)).toBeNull();
  });

  it.each(["/c/mari", "/admin", "/owner", "/me", "/api/admin/users", "/api/owner/creators", "/api/auth/callback/google", "/api/quotes", "/api/health", "/_next/static/a.js", "/_next/image", "/favicon.ico", "/quotes", "/obs/quotes"])("does not rewrite %s", pathname => {
    expect(route("mari.ludylops.live", pathname)).toBeNull();
  });

  it("uses the first forwarded host, consistently with the public resolver", () => {
    expect(route("internal", "/", "MARI.ludylops.live:443, internal")).toBe("/c/mari");
    expect(route("mari.ludylops.live", "/", "unknown.example, mari.ludylops.live")).toBeNull();
    expect(route("mari.ludylops.live", "/", "https://mari.ludylops.live")).toBeNull();
    expect(route("mari.ludylops.live", "/", "")).toBeNull();
  });

  it("uses the URL authority only when neither host header is present", () => {
    expect(getCreatorRootPath(new Request("https://mari.ludylops.live/?ref=live"))).toBe("/c/mari");
  });
});
