import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/client", () => ({
  getDb: getDbMock,
}));

describe("active death counter game config", () => {
  beforeEach(() => {
    vi.resetModules();
    getDbMock.mockReset();
    getDbMock.mockReturnValue(null);
    delete (globalThis as typeof globalThis & {
      __lojaActiveDeathCounterGame?: unknown;
    }).__lojaActiveDeathCounterGame;
  });

  it("stores and clears the active game in demo mode", async () => {
    const deathCounterGame = await import("@/lib/streamerbot/death-counter-game");

    const saved = await deathCounterGame.setActiveDeathCounterGame({
      gameName: "Hollow Knight: Silksong",
      updatedBy: "admin@example.com",
    });

    expect(saved).toMatchObject({
      scopeType: "game",
      scopeKey: "hollow-knight-silksong",
      scopeLabel: "Hollow Knight: Silksong",
      updatedBy: "admin@example.com",
    });

    await expect(deathCounterGame.getActiveDeathCounterGame()).resolves.toMatchObject({
      scopeKey: "hollow-knight-silksong",
      scopeLabel: "Hollow Knight: Silksong",
    });

    await expect(deathCounterGame.clearActiveDeathCounterGame()).resolves.toBeNull();
    await expect(deathCounterGame.getActiveDeathCounterGame()).resolves.toBeNull();
  });

  it("reads the active game from streamerbot_counters in database mode", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                updatedAt: new Date("2026-04-21T20:00:00.000Z"),
                metadata: {
                  scopeType: "game",
                  scopeKey: "silksong",
                  scopeLabel: "Silksong",
                  updatedBy: "admin@example.com",
                },
              },
            ],
          }),
        }),
      }),
    });

    const deathCounterGame = await import("@/lib/streamerbot/death-counter-game");

    await expect(deathCounterGame.getActiveDeathCounterGame()).resolves.toEqual({
      scopeType: "game",
      scopeKey: "silksong",
      scopeLabel: "Silksong",
      updatedAt: "2026-04-21T20:00:00.000Z",
      updatedBy: "admin@example.com",
    });
  });
});
