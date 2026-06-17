import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const bridgeHeartbeatMock = vi.hoisted(() => vi.fn());
const bridgePullMock = vi.hoisted(() => vi.fn());
const bridgeClaimMock = vi.hoisted(() => vi.fn());
const bridgeCompleteMock = vi.hoisted(() => vi.fn());
const bridgeFailMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/env", () => ({
  env: {
    BRIDGE_SHARED_SECRET: "test-bridge-secret",
  },
  isDemoMode: true,
  isProduction: false,
  adminEmails: new Set<string>(),
}));

vi.mock("@/lib/db/repository", () => ({
  bridgeHeartbeat: bridgeHeartbeatMock,
  bridgePull: bridgePullMock,
  bridgeClaim: bridgeClaimMock,
  bridgeComplete: bridgeCompleteMock,
  bridgeFail: bridgeFailMock,
}));

import { buildSignature } from "@/lib/streamerbot/security";
import { POST as heartbeatPost } from "@/app/api/internal/bridge/heartbeat/route";
import { POST as pullPost } from "@/app/api/internal/bridge/pull/route";
import { POST as claimPost } from "@/app/api/internal/bridge/[redemptionId]/claim/route";
import { POST as completePost } from "@/app/api/internal/bridge/[redemptionId]/complete/route";
import { POST as failPost } from "@/app/api/internal/bridge/[redemptionId]/fail/route";

function signedRequest(
  body: unknown,
  options: { secret?: string; timestamp?: number; includeSignature?: boolean } = {},
) {
  const raw = JSON.stringify(body);
  const timestamp = `${options.timestamp ?? Date.now()}`;
  const headers = new Headers({
    "content-type": "application/json",
    "x-timestamp": timestamp,
  });

  if (options.includeSignature !== false) {
    headers.set(
      "x-signature",
      buildSignature({
        body: raw,
        timestamp,
        secret: options.secret ?? "test-bridge-secret",
      }),
    );
  }

  return new Request("http://localhost/api/internal/bridge", {
    method: "POST",
    headers,
    body: raw,
  });
}

function redemptionParams(redemptionId = "red-1") {
  return {
    params: Promise.resolve({ redemptionId }),
  };
}

describe("bridge route handlers", () => {
  beforeEach(() => {
    authMock.mockReset();
    bridgeHeartbeatMock.mockReset();
    bridgePullMock.mockReset();
    bridgeClaimMock.mockReset();
    bridgeCompleteMock.mockReset();
    bridgeFailMock.mockReset();
  });

  it("rejects unsigned heartbeat requests", async () => {
    const response = await heartbeatPost(
      signedRequest({ bridgeId: "bridge-1", machineKey: "machine-1", label: "Bridge local" }, { includeSignature: false }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Invalid signature." });
    expect(bridgeHeartbeatMock).not.toHaveBeenCalled();
  });

  it("rejects heartbeat requests signed with the wrong secret", async () => {
    const response = await heartbeatPost(
      signedRequest(
        { bridgeId: "bridge-1", machineKey: "machine-1", label: "Bridge local" },
        { secret: "other-secret" },
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Invalid signature." });
    expect(bridgeHeartbeatMock).not.toHaveBeenCalled();
  });

  it("accepts valid heartbeat requests", async () => {
    const payload = { bridgeId: "bridge-1", machineKey: "machine-1", label: "Bridge local" };
    bridgeHeartbeatMock.mockResolvedValueOnce({ acknowledged: true });

    const response = await heartbeatPost(signedRequest(payload));

    expect(bridgeHeartbeatMock).toHaveBeenCalledWith(payload);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { acknowledged: true },
    });
  });

  it("rejects unsigned pull requests", async () => {
    const response = await pullPost(signedRequest({ requestedBy: "bridge" }, { includeSignature: false }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Invalid signature." });
    expect(bridgePullMock).not.toHaveBeenCalled();
  });

  it("rejects pull requests signed with the wrong secret", async () => {
    const response = await pullPost(signedRequest({ requestedBy: "bridge" }, { secret: "other-secret" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Invalid signature." });
    expect(bridgePullMock).not.toHaveBeenCalled();
  });

  it("accepts valid pull requests", async () => {
    bridgePullMock.mockResolvedValueOnce([{ id: "red-1" }]);

    const response = await pullPost(signedRequest({ requestedBy: "bridge" }));

    expect(bridgePullMock).toHaveBeenCalledWith();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: [{ id: "red-1" }],
    });
  });

  it("rejects unsigned claim requests", async () => {
    const response = await claimPost(
      signedRequest({ bridgeId: "bridge-1" }, { includeSignature: false }),
      redemptionParams(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Invalid signature." });
    expect(bridgeClaimMock).not.toHaveBeenCalled();
  });

  it("rejects claim requests signed with the wrong secret", async () => {
    const response = await claimPost(
      signedRequest({ bridgeId: "bridge-1" }, { secret: "other-secret" }),
      redemptionParams(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Invalid signature." });
    expect(bridgeClaimMock).not.toHaveBeenCalled();
  });

  it("accepts valid claim requests", async () => {
    bridgeClaimMock.mockResolvedValueOnce({ claimed: true });

    const response = await claimPost(signedRequest({ bridgeId: "bridge-1" }), redemptionParams("red-1"));

    expect(bridgeClaimMock).toHaveBeenCalledWith("red-1", "bridge-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { claimed: true },
    });
  });

  it("rejects claim requests with a stale timestamp", async () => {
    const response = await claimPost(
      signedRequest({ bridgeId: "bridge-1" }, { timestamp: Date.now() - 10 * 60 * 1000 }),
      redemptionParams(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Invalid signature." });
    expect(bridgeClaimMock).not.toHaveBeenCalled();
  });

  it("rejects unsigned complete requests", async () => {
    const response = await completePost(
      signedRequest({ bridgeId: "bridge-1", executionNote: "done" }, { includeSignature: false }),
      redemptionParams(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Invalid signature." });
    expect(bridgeCompleteMock).not.toHaveBeenCalled();
  });

  it("rejects complete requests signed with the wrong secret", async () => {
    const response = await completePost(
      signedRequest({ bridgeId: "bridge-1", executionNote: "done" }, { secret: "other-secret" }),
      redemptionParams(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Invalid signature." });
    expect(bridgeCompleteMock).not.toHaveBeenCalled();
  });

  it("accepts valid complete requests", async () => {
    bridgeCompleteMock.mockResolvedValueOnce({ completed: true });

    const response = await completePost(
      signedRequest({ bridgeId: "bridge-1", executionNote: "done" }),
      redemptionParams("red-1"),
    );

    expect(bridgeCompleteMock).toHaveBeenCalledWith("red-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { completed: true },
    });
  });

  it("rejects unsigned fail requests", async () => {
    const response = await failPost(
      signedRequest({ bridgeId: "bridge-1", failureReason: "Timed out" }, { includeSignature: false }),
      redemptionParams(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Invalid signature." });
    expect(bridgeFailMock).not.toHaveBeenCalled();
  });

  it("rejects fail requests signed with the wrong secret", async () => {
    const response = await failPost(
      signedRequest({ bridgeId: "bridge-1", failureReason: "Timed out" }, { secret: "other-secret" }),
      redemptionParams(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Invalid signature." });
    expect(bridgeFailMock).not.toHaveBeenCalled();
  });

  it("accepts valid fail requests", async () => {
    bridgeFailMock.mockResolvedValueOnce({ failed: true });

    const response = await failPost(
      signedRequest({ bridgeId: "bridge-1", failureReason: "Timed out" }),
      redemptionParams("red-1"),
    );

    expect(bridgeFailMock).toHaveBeenCalledWith("red-1", "Timed out");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { failed: true },
    });
  });
});
