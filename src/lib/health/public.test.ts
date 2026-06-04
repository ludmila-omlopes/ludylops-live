import { describe, expect, it } from "vitest";

import { buildPublicHealthSnapshot } from "@/lib/health/public";

const authReady = {
  ready: true,
  status: "ready" as const,
  availableProviders: ["google"],
  googleOAuthConfigured: true,
  googleOAuthCallbackUrls: ["https://example.test/api/auth/callback/google"],
  demoAuthEnabled: false,
  nextAuthSecretConfigured: true,
  usesFallbackSecret: false,
  failures: [],
  warnings: [],
};

describe("buildPublicHealthSnapshot", () => {
  it("makes demo mode explicit and keeps public bridge details safe", () => {
    const snapshot = buildPublicHealthSnapshot({
      mode: "demo",
      auth: {
        ...authReady,
        availableProviders: ["credentials"],
        googleOAuthConfigured: false,
        demoAuthEnabled: true,
      },
      bridge: [],
      now: new Date("2026-04-03T12:00:00.000Z"),
    });

    expect(snapshot.status).toBe("ok");
    expect(snapshot.database).toEqual({
      configured: false,
      ready: true,
      status: "demo",
    });
    expect(snapshot.bridge).toEqual({
      ready: false,
      status: "missing",
      clientCount: 0,
      mostRecentHeartbeatAt: null,
      mostRecentHeartbeatAgeSeconds: null,
    });
  });

  it("marks the bridge online when the latest heartbeat is fresh", () => {
    const snapshot = buildPublicHealthSnapshot({
      mode: "database",
      auth: authReady,
      bridge: [
        {
          id: "bridge-1",
          machineKey: "hidden-from-public-route",
          label: "Studio PC",
          lastSeenAt: "2026-04-03T11:59:30.000Z",
        },
      ],
      now: new Date("2026-04-03T12:00:00.000Z"),
    });

    expect(snapshot.status).toBe("ok");
    expect(snapshot.database).toEqual({
      configured: true,
      ready: true,
      status: "ready",
    });
    expect(snapshot.bridge).toEqual({
      ready: true,
      status: "online",
      clientCount: 1,
      mostRecentHeartbeatAt: "2026-04-03T11:59:30.000Z",
      mostRecentHeartbeatAgeSeconds: 30,
    });
  });

  it("surfaces database/auth failures without leaking secrets", () => {
    const snapshot = buildPublicHealthSnapshot({
      mode: "database",
      auth: {
        ...authReady,
        ready: false,
        status: "degraded",
        availableProviders: [],
        googleOAuthConfigured: false,
        failures: ["no_auth_provider_configured"],
        warnings: ["nextauth_secret_missing_using_fallback"],
        nextAuthSecretConfigured: false,
        usesFallbackSecret: true,
      },
      bridge: [],
      bridgeQueryFailed: true,
      now: new Date("2026-04-03T12:00:00.000Z"),
    });

    expect(snapshot.status).toBe("degraded");
    expect(snapshot.failures).toEqual([
      "auth:no_auth_provider_configured",
      "database:bridge_status_unavailable",
    ]);
    expect(snapshot.warnings).toEqual(["nextauth_secret_missing_using_fallback"]);
    expect(snapshot.database).toEqual({
      configured: true,
      ready: false,
      status: "error",
    });
    expect(snapshot.bridge).toEqual({
      ready: false,
      status: "error",
      clientCount: 0,
      mostRecentHeartbeatAt: null,
      mostRecentHeartbeatAgeSeconds: null,
    });
  });
});
