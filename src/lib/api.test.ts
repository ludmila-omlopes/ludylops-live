import { beforeEach, describe, expect, it, vi } from "vitest";

import { isTrustedAppMutationRequest } from "@/lib/request-origin";

const authMock = vi.hoisted(() => vi.fn());
const envState = vi.hoisted(() => ({
  isDemoMode: false,
  isProduction: false,
  adminEmails: new Set<string>(),
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
}));

import { requireAdminApiSession } from "@/lib/api";

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
