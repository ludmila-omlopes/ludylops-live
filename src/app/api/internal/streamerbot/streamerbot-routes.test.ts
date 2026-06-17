import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const ingestStreamerbotEventMock = vi.hoisted(() => vi.fn());
const claimViewerLinkCodeFromStreamerbotMock = vi.hoisted(() => vi.fn());
const getViewerBalanceFromChatCommandMock = vi.hoisted(() => vi.fn());
const placeBetFromChatCommandMock = vi.hoisted(() => vi.fn());
const runStreamerbotCounterCommandMock = vi.hoisted(() => vi.fn());
const runDeathCounterCommandMock = vi.hoisted(() => vi.fn());
const runQuoteCommandFromChatMock = vi.hoisted(() => vi.fn());
const getPipetzPricingMock = vi.hoisted(() => vi.fn());
const triggerWheelSpinMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/env", () => ({
  env: {
    STREAMERBOT_SHARED_SECRET: "test-streamerbot-secret",
  },
  isDemoMode: true,
  isProduction: false,
  adminEmails: new Set<string>(),
}));

vi.mock("@/lib/db/repository", () => ({
  ingestStreamerbotEvent: ingestStreamerbotEventMock,
  claimViewerLinkCodeFromStreamerbot: claimViewerLinkCodeFromStreamerbotMock,
  getViewerBalanceFromChatCommand: getViewerBalanceFromChatCommandMock,
  placeBetFromChatCommand: placeBetFromChatCommandMock,
  runStreamerbotCounterCommand: runStreamerbotCounterCommandMock,
  runDeathCounterCommand: runDeathCounterCommandMock,
  runQuoteCommandFromChat: runQuoteCommandFromChatMock,
  getPipetzPricing: getPipetzPricingMock,
}));

vi.mock("@/lib/wheel", () => ({
  triggerWheelSpin: triggerWheelSpinMock,
}));

import { buildSignature } from "@/lib/streamerbot/security";
import { POST as eventsPost } from "@/app/api/internal/streamerbot/events/route";
import { POST as linkPost } from "@/app/api/internal/streamerbot/link/route";
import { POST as pointsPost } from "@/app/api/internal/streamerbot/points/route";
import { POST as placeBetPost } from "@/app/api/internal/streamerbot/bets/place/route";
import { POST as countersPost } from "@/app/api/internal/streamerbot/counters/route";
import { POST as deathsPost } from "@/app/api/internal/streamerbot/deaths/route";
import { POST as quotesPost } from "@/app/api/internal/streamerbot/quotes/route";
import { POST as wheelPost } from "@/app/api/internal/streamerbot/wheel/route";

function signedRequest(
  body: unknown,
  options: { secret?: string; timestamp?: number; includeSignature?: boolean; rawBody?: string } = {},
) {
  const raw = options.rawBody ?? JSON.stringify(body);
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
        secret: options.secret ?? "test-streamerbot-secret",
      }),
    );
  }

  return new Request("http://localhost/api/internal/streamerbot", {
    method: "POST",
    headers,
    body: raw,
  });
}

describe("streamerbot route handlers", () => {
  beforeEach(() => {
    authMock.mockReset();
    ingestStreamerbotEventMock.mockReset();
    claimViewerLinkCodeFromStreamerbotMock.mockReset();
    getViewerBalanceFromChatCommandMock.mockReset();
    placeBetFromChatCommandMock.mockReset();
    runStreamerbotCounterCommandMock.mockReset();
    runDeathCounterCommandMock.mockReset();
    runQuoteCommandFromChatMock.mockReset();
    getPipetzPricingMock.mockReset();
    triggerWheelSpinMock.mockReset();
  });

  it("rejects unsigned event requests", async () => {
    const payload = {
      eventId: "evt-1",
      eventType: "presence_tick",
      viewerExternalId: "yt-1",
      amount: 5,
      occurredAt: "2026-06-17T12:00:00.000Z",
      payload: {},
    };

    const response = await eventsPost(signedRequest(payload, { includeSignature: false }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Invalid signature." });
    expect(ingestStreamerbotEventMock).not.toHaveBeenCalled();
  });

  it("accepts valid event requests", async () => {
    const payload = {
      eventId: "evt-1",
      eventType: "presence_tick",
      viewerExternalId: "yt-1",
      amount: 5,
      occurredAt: "2026-06-17T12:00:00.000Z",
      payload: {},
    };
    ingestStreamerbotEventMock.mockResolvedValueOnce({ stored: true });

    const response = await eventsPost(signedRequest(payload));

    expect(ingestStreamerbotEventMock).toHaveBeenCalledWith(payload);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { stored: true },
    });
  });

  it("rejects unsigned link requests", async () => {
    const response = await linkPost(
      signedRequest({ linkCode: "abcd", viewerExternalId: "yt-1", youtubeDisplayName: "Ana" }, { includeSignature: false }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Invalid signature." });
    expect(claimViewerLinkCodeFromStreamerbotMock).not.toHaveBeenCalled();
  });

  it("accepts valid link requests", async () => {
    claimViewerLinkCodeFromStreamerbotMock.mockResolvedValueOnce({
      viewer: { id: "viewer-1" },
      googleAccountId: "google-1",
      mergedSyntheticViewer: false,
    });

    const response = await linkPost(
      signedRequest({ linkCode: "abcd", viewerExternalId: "yt-1", youtubeDisplayName: "Ana", youtubeHandle: "@ana" }),
    );

    expect(claimViewerLinkCodeFromStreamerbotMock).toHaveBeenCalledWith({
      linkCode: "ABCD",
      viewerExternalId: "yt-1",
      youtubeDisplayName: "Ana",
      youtubeHandle: "@ana",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        viewerId: "viewer-1",
        googleAccountId: "google-1",
        mergedSyntheticViewer: false,
        replyMessage: expect.any(String),
      },
    });
  });

  it("rejects unsigned points requests", async () => {
    const response = await pointsPost(
      signedRequest({ viewerExternalId: "yt-1", youtubeDisplayName: "Ana" }, { includeSignature: false }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Invalid signature.",
      replyMessage: expect.any(String),
    });
    expect(getViewerBalanceFromChatCommandMock).not.toHaveBeenCalled();
  });

  it("accepts valid points requests", async () => {
    const payload = { viewerExternalId: "yt-1", youtubeDisplayName: "Ana", source: "streamerbot_chat" };
    getViewerBalanceFromChatCommandMock.mockResolvedValueOnce({
      viewer: { id: "viewer-1", youtubeChannelId: "yt-1", youtubeDisplayName: "Ana" },
      balance: {
        currentBalance: 120,
        lifetimeEarned: 200,
        lifetimeSpent: 80,
        lastSyncedAt: "2026-06-17T12:00:00.000Z",
      },
    });

    const response = await pointsPost(signedRequest({ viewerExternalId: "yt-1", youtubeDisplayName: "Ana" }));

    expect(getViewerBalanceFromChatCommandMock).toHaveBeenCalledWith(payload);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        viewerId: "viewer-1",
        viewerExternalId: "yt-1",
        balance: 120,
        lifetimeEarned: 200,
        lifetimeSpent: 80,
        lastSyncedAt: "2026-06-17T12:00:00.000Z",
        replyMessage: expect.any(String),
      },
    });
  });

  it("returns a chat-friendly error when points lookup fails", async () => {
    getViewerBalanceFromChatCommandMock.mockRejectedValueOnce(new Error("viewer_not_ready"));

    const response = await pointsPost(signedRequest({ viewerExternalId: "yt-1", youtubeDisplayName: "Ana" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "viewer_not_ready",
      replyMessage: expect.any(String),
    });
  });

  it("rejects unsigned bet requests", async () => {
    const response = await placeBetPost(
      signedRequest(
        { viewerExternalId: "yt-1", youtubeDisplayName: "Ana", optionId: "opt-1", amount: 10 },
        { includeSignature: false },
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Invalid signature.",
      replyMessage: expect.any(String),
    });
    expect(placeBetFromChatCommandMock).not.toHaveBeenCalled();
  });

  it("accepts valid bet requests", async () => {
    const payload = {
      viewerExternalId: "yt-1",
      youtubeDisplayName: "Ana",
      optionId: "opt-1",
      amount: 10,
      source: "streamerbot_chat",
    };
    placeBetFromChatCommandMock.mockResolvedValueOnce({
      bet: { id: "bet-1", question: "Vai dar certo?" },
      option: { id: "opt-1", label: "Sim", sortOrder: 0 },
      viewer: { id: "viewer-1", youtubeDisplayName: "Ana" },
      entry: { amount: 10 },
    });

    const response = await placeBetPost(
      signedRequest({ viewerExternalId: "yt-1", youtubeDisplayName: "Ana", optionId: "opt-1", amount: 10 }),
    );

    expect(placeBetFromChatCommandMock).toHaveBeenCalledWith(payload);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        betId: "bet-1",
        optionId: "opt-1",
        optionIndex: 1,
        optionLabel: "Sim",
        viewerId: "viewer-1",
        viewerExternalId: "yt-1",
        amount: 10,
        replyMessage: expect.any(String),
      },
    });
  });

  it("rejects unsigned counter requests", async () => {
    const response = await countersPost(
      signedRequest(
        { counterKey: "mortes", action: "increment", amount: 1, scopeType: "global", requestedBy: "Ana" },
        { includeSignature: false },
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Invalid signature.",
      replyMessage: expect.any(String),
    });
    expect(runStreamerbotCounterCommandMock).not.toHaveBeenCalled();
  });

  it("accepts valid counter requests", async () => {
    const payload = {
      counterKey: "mortes",
      action: "increment",
      amount: 1,
      scopeType: "global",
      requestedBy: "Ana",
      source: "streamerbot_chat",
      confirmReset: false,
    };
    runStreamerbotCounterCommandMock.mockResolvedValueOnce({
      action: "increment",
      count: 3,
      mode: "demo",
      counter: {
        key: "mortes",
        scopeType: "global",
        scopeKey: null,
        lastResetAt: null,
        updatedAt: "2026-06-17T12:00:00.000Z",
      },
      replyMessage: "Ana, contador atualizado.",
    });

    const response = await countersPost(
      signedRequest({ counterKey: "mortes", action: "increment", amount: 1, scopeType: "global", requestedBy: "Ana" }),
    );

    expect(runStreamerbotCounterCommandMock).toHaveBeenCalledWith(payload);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        action: "increment",
        count: 3,
        counterKey: "mortes",
        scopeType: "global",
        scopeKey: null,
        lastResetAt: null,
        updatedAt: "2026-06-17T12:00:00.000Z",
        replyMessage: "Ana, contador atualizado.",
      },
    });
  });

  it("rejects unsigned death counter requests", async () => {
    const response = await deathsPost(
      signedRequest({ action: "increment", amount: 1, scopeType: "global", requestedBy: "Ana" }, { includeSignature: false }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Invalid signature.",
      replyMessage: expect.any(String),
    });
    expect(runDeathCounterCommandMock).not.toHaveBeenCalled();
  });

  it("accepts valid death counter requests", async () => {
    const payload = {
      action: "increment",
      amount: 1,
      scopeType: "global",
      requestedBy: "Ana",
      source: "streamerbot_chat",
      confirmReset: false,
    };
    runDeathCounterCommandMock.mockResolvedValueOnce({
      action: "increment",
      count: 7,
      mode: "demo",
      counter: {
        key: "death_counter",
        scopeType: "global",
        scopeKey: null,
        lastResetAt: null,
        updatedAt: "2026-06-17T12:00:00.000Z",
      },
      replyMessage: "Ana, mortes atualizadas.",
    });

    const response = await deathsPost(
      signedRequest({ action: "increment", amount: 1, scopeType: "global", requestedBy: "Ana" }),
    );

    expect(runDeathCounterCommandMock).toHaveBeenCalledWith(payload);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        action: "increment",
        count: 7,
        counterKey: "death_counter",
        scopeType: "global",
        scopeKey: null,
        lastResetAt: null,
        updatedAt: "2026-06-17T12:00:00.000Z",
        replyMessage: "Ana, mortes atualizadas.",
      },
    });
  });

  it("rejects unsigned quote requests", async () => {
    const response = await quotesPost(signedRequest({ action: "get" }, { includeSignature: false }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Invalid signature.",
      replyMessage: expect.any(String),
    });
    expect(runQuoteCommandFromChatMock).not.toHaveBeenCalled();
  });

  it("accepts valid quote requests", async () => {
    const payload = {
      action: "get",
      displayDurationSeconds: 12,
      isModerator: false,
      isBroadcaster: false,
      isAdmin: false,
      source: "streamerbot_chat",
    };
    runQuoteCommandFromChatMock.mockResolvedValueOnce({
      action: "get",
      quote: {
        quoteNumber: 12,
        body: "Teste de quote",
      },
    });

    const response = await quotesPost(signedRequest({ action: "get" }));

    expect(runQuoteCommandFromChatMock).toHaveBeenCalledWith(payload);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      replyMessage: 'Quote #12: "Teste de quote"',
      data: {
        action: "get",
        quoteId: 12,
        quote: {
          quoteNumber: 12,
          body: "Teste de quote",
        },
        overlay: null,
        queued: null,
        replyMessage: 'Quote #12: "Teste de quote"',
      },
    });
  });

  it("rejects unsigned wheel requests", async () => {
    const response = await wheelPost(signedRequest({ requestedBy: "Ana" }, { includeSignature: false }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Invalid signature.",
      replyMessage: expect.any(String),
    });
    expect(triggerWheelSpinMock).not.toHaveBeenCalled();
  });

  it("accepts valid wheel requests", async () => {
    triggerWheelSpinMock.mockResolvedValueOnce({
      title: "Roleta",
      spinDurationMs: 5200,
      resultHoldSeconds: 30,
      updatedAt: "2026-06-17T12:00:00.000Z",
      updatedBy: null,
      options: [],
      lastSpin: {
        spinId: "spin-1",
        optionId: "opt-1",
        label: "Prêmio",
        color: "#41d1ff",
        requestedBy: "Ana",
        source: "streamerbot_chat",
        startedAt: "2026-06-17T12:00:00.000Z",
        spinDurationMs: 5200,
        resultVisibleUntil: "2026-06-17T12:00:35.200Z",
      },
    });

    const response = await wheelPost(signedRequest({ requestedBy: "Ana" }));

    expect(triggerWheelSpinMock).toHaveBeenCalledWith({
      requestedBy: "Ana",
      source: "web",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        config: expect.any(Object),
        result: {
          spinId: "spin-1",
          optionId: "opt-1",
          label: "Prêmio",
        },
        replyMessage: "Roleta girando: Prêmio.",
      },
    });
  });
});
