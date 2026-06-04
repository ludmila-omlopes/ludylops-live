import { afterEach, describe, expect, it, vi } from "vitest";

import { getGoogleOAuthCallbackUrls } from "@/lib/auth/public-health";

describe("getGoogleOAuthCallbackUrls", () => {
  it("builds unique Google callback URLs from configured app base URLs", () => {
    expect(
      getGoogleOAuthCallbackUrls([
        "https://ludylops.live/",
        "https://ludylops.live",
        "https://ludylops.vercel.app",
      ]),
    ).toEqual([
      "https://ludylops.live/api/auth/callback/google",
      "https://ludylops.vercel.app/api/auth/callback/google",
    ]);
  });
});

describe("getPublicAuthHealth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("surfaces the Google callback URLs expected for deploy configuration", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "google-client-id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "google-client-secret");
    vi.stubEnv("APP_URL", "https://ludylops.live/");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ludylops.vercel.app");
    vi.resetModules();

    const { getPublicAuthHealth } = await import("@/lib/auth/public-health");

    expect(getPublicAuthHealth()).toMatchObject({
      googleOAuthConfigured: true,
      googleOAuthCallbackUrls: [
        "https://ludylops.live/api/auth/callback/google",
        "https://ludylops.vercel.app/api/auth/callback/google",
      ],
    });
  });
});
