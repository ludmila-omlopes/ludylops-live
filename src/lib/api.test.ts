import { beforeEach, describe, expect, it, vi } from "vitest";

import { isTrustedAppMutationRequest } from "@/lib/request-origin";

const authMock = vi.hoisted(() => vi.fn());
const envState = vi.hoisted(() => ({
  isDemoMode: false,
  isProduction: false,
  adminEmails: new Set<string>(),
  platformOwnerEmails: new Set<string>(),
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/env", () => ({
  get isDemoMode() {
    return envState.isDemoMode;
  },
  get isProduction() {
    return envState.isProduction;
  },
  get adminEmails() {
    return envState.adminEmails;
  },
  get platformOwnerEmails() {
    return envState.platformOwnerEmails;
  },
}));

import { requireAdminApiSession, requirePlatformOwnerApiSession } from "@/lib/api";

describe("isTrustedAppMutationRequest", () => {
  it("accepts matching origin headers", () => {
    const request = new Request("https://ludylops.live/api/me/redeem", {
      method: "POST",
      headers: {
        origin: "https://ludylops.live",
      },
    });

    expect(isTrustedAppMutationRequest(request)).toBe(true);
  });

  it("accepts matching referer when origin is absent", () => {
    const request = new Request("https://ludylops.live/api/me/redeem", {
      method: "POST",
      headers: {
        referer: "https://ludylops.live/me",
      },
    });

    expect(isTrustedAppMutationRequest(request)).toBe(true);
  });

  it("rejects cross-site origins", () => {
    const request = new Request("https://ludylops.live/api/me/redeem", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
      },
    });

    expect(isTrustedAppMutationRequest(request)).toBe(false);
  });

  it("rejects requests without origin metadata", () => {
    const request = new Request("https://ludylops.live/api/me/redeem", {
      method: "POST",
    });

    expect(isTrustedAppMutationRequest(request)).toBe(false);
  });
});

describe("requireAdminApiSession", () => {
  const session = {
    expires: "2099-01-01T00:00:00.000Z",
    user: { email: "viewer@example.com" },
  };

  beforeEach(() => {
    authMock.mockReset();
    authMock.mockResolvedValue(session);
    envState.isDemoMode = true;
    envState.isProduction = false;
    envState.adminEmails = new Set<string>();
    envState.platformOwnerEmails = new Set<string>();
  });

  it("rejects a non-admin user in production demo mode", async () => {
    envState.isProduction = true;

    await expect(requireAdminApiSession()).resolves.toBeNull();
  });

  it("keeps the demo admin bypass outside production", async () => {
    envState.isProduction = false;

    await expect(requireAdminApiSession()).resolves.toBe(session);
  });
});

describe("requirePlatformOwnerApiSession", () => {
  const session = {
    expires: "2099-01-01T00:00:00.000Z",
    user: { email: "owner@example.com" },
  };

  beforeEach(() => {
    authMock.mockReset();
    authMock.mockResolvedValue(session);
    envState.isDemoMode = false;
    envState.isProduction = false;
    envState.adminEmails = new Set<string>(["admin@example.com"]);
    envState.platformOwnerEmails = new Set<string>(["owner@example.com"]);
  });

  it("allows configured platform owners", async () => {
    await expect(requirePlatformOwnerApiSession()).resolves.toBe(session);
  });

  it("does not allow regular admins by default when platform owners are configured", async () => {
    authMock.mockResolvedValue({
      ...session,
      user: { email: "admin@example.com" },
    });

    await expect(requirePlatformOwnerApiSession()).resolves.toBeNull();
  });

  it("keeps the owner bypass limited to non-production demo mode", async () => {
    envState.isDemoMode = true;
    envState.isProduction = true;
    envState.platformOwnerEmails = new Set<string>();

    await expect(requirePlatformOwnerApiSession()).resolves.toBeNull();

    envState.isProduction = false;

    await expect(requirePlatformOwnerApiSession()).resolves.toBe(session);
  });
});
