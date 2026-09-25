import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPlatformHost, isLegacyCommunityHost, requestHostname } from "./hosts";
import { creatorPlatformUrl, getPlatformOrigin } from "./platform";

beforeEach(() => {
  for (const key of ["APP_URL", "NEXT_PUBLIC_APP_URL", "VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"]) vi.stubEnv(key, "");
  vi.stubEnv("NEXT_PUBLIC_PLATFORM_URL", "https://creator-hub.example.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("separate platform and community hosts", () => {
  it("allows only exact configured hosts, never arbitrary Vercel domains", () => {
    vi.stubEnv("VERCEL_URL", "current-preview.vercel.app");
    vi.stubEnv("VERCEL_BRANCH_URL", "current-branch.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "production.vercel.app");
    for (const host of ["creator-hub.example.com", "current-preview.vercel.app", "current-branch.vercel.app", "production.vercel.app", "localhost"]) expect(isPlatformHost(host)).toBe(true);
    for (const host of [null, "other.vercel.app", "child.creator-hub.example.com", "creator-hub.example.com.evil.test", "ludylops.live", "www.ludylops.live"]) expect(isPlatformHost(host)).toBe(false);
  });
  it("does not promote the legacy community via APP_URL", () => {
    vi.stubEnv("APP_URL", "https://ludylops.live");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.ludylops.live");
    expect(isPlatformHost("ludylops.live")).toBe(false);
    expect(isLegacyCommunityHost("ludylops.live")).toBe(true);
    expect(isLegacyCommunityHost("creator-hub.example.com")).toBe(false);
  });
  it.each(["https://user@foreign.example", "https://foreign.example/path", "https://foreign.example?x=1", "ftp://foreign.example"])("ignores malformed deployment origin %s", value => {
    vi.stubEnv("VERCEL_URL", value);
    expect(isPlatformHost("foreign.example")).toBe(false);
  });
  it("uses only the first forwarded host and rejects malformed input without fallback", () => {
    const request = (forwarded: string) => new Request("https://creator-hub.example.com/", { headers: { "x-forwarded-host": forwarded, host: "creator-hub.example.com" } });
    expect(requestHostname(request("LUDYLOPS.live:443, internal"))).toBe("ludylops.live");
    expect(requestHostname(request("bad/path"))).toBeNull();
    expect(requestHostname(request(""))).toBeNull();
  });
  it("builds community URLs from the platform origin", () => {
    expect(creatorPlatformUrl("teste-1")).toBe("https://creator-hub.example.com/c/teste-1");
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_URL", "http://localhost:3000");
    expect(getPlatformOrigin()).toBe("http://localhost:3000");
  });
  it.each(["http://public.example.com", "https://user:password@example.com", "https://example.com/path", "https://example.com?query=1", "invalid"])("refuses invalid platform origin %s", origin => {
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_URL", origin);
    expect(() => getPlatformOrigin()).toThrow();
  });
});
