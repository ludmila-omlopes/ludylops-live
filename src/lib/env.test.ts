import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("env authSecret", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws in production when NEXTAUTH_SECRET is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXTAUTH_SECRET", undefined);

    await expect(import("@/lib/env")).rejects.toThrow(/NEXTAUTH_SECRET/);
  });

  it("uses the configured secret in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXTAUTH_SECRET", "abc");

    const { authSecret } = await import("@/lib/env");

    expect(authSecret).toBe("abc");
  });

  it("falls back to dev-secret outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXTAUTH_SECRET", undefined);

    const { authSecret } = await import("@/lib/env");

    expect(authSecret).toBe("dev-secret");
  });
});
