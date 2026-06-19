import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/client", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/env", () => ({
  isDemoMode: false,
  adminEmails: new Set(["admin@example.com"]),
  env: {},
}));

import { pointLedger, redemptions, viewerBalances } from "@/lib/db/schema";
import { bridgeClaim, bridgeComplete, bridgeFail } from "@/lib/db/repository";
import type { RedemptionRecord } from "@/lib/types";

function redemption(overrides: Partial<RedemptionRecord> = {}): RedemptionRecord {
  return {
    id: "red-1",
    viewerId: "viewer-1",
    catalogItemId: "item-1",
    status: "queued",
    costAtPurchase: 250,
    requestSource: "web",
    idempotencyKey: "idem-red-1",
    bridgeAttemptCount: 0,
    claimedByBridgeId: null,
    queuedAt: "2026-06-19T10:00:00.000Z",
    executedAt: null,
    failedAt: null,
    failureReason: null,
    ...overrides,
  };
}

function createBridgeDb({
  updateRows = [],
  selectRows = [],
}: {
  updateRows?: unknown[][];
  selectRows?: unknown[][];
} = {}) {
  const updateQueue = [...updateRows];
  const selectQueue = [...selectRows];
  const balanceUpdateWhere = vi.fn(async () => undefined);
  const ledgerInsertValues = vi.fn(async () => undefined);

  const updateBuilder = (table: unknown) => ({
    set: () => {
      if (table === redemptions) {
        return {
          where: () => ({
            returning: async () => updateQueue.shift() ?? [],
          }),
        };
      }

      if (table === viewerBalances) {
        return {
          where: balanceUpdateWhere,
        };
      }

      throw new Error("Unexpected update table in bridge db stub.");
    },
  });

  const tx = {
    update: updateBuilder,
    insert(table: unknown) {
      if (table !== pointLedger) {
        throw new Error("Unexpected insert table in bridge db stub.");
      }

      return {
        values: ledgerInsertValues,
      };
    },
  };

  const db = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => selectQueue.shift() ?? [],
              };
            },
          };
        },
      };
    },
    update: updateBuilder,
    async transaction<T>(callback: (txArg: typeof tx) => Promise<T>) {
      return callback(tx);
    },
  };

  return {
    db,
    balanceUpdateWhere,
    ledgerInsertValues,
  };
}

describe("bridgeClaim", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("returns null when no queued redemption is claimed", async () => {
    const { db } = createBridgeDb({ updateRows: [[]] });
    getDbMock.mockReturnValue(db);

    await expect(bridgeClaim("red-1", "bridge-1")).resolves.toBeNull();
  });

  it("returns the claimed executing redemption", async () => {
    const row = redemption({
      status: "executing",
      claimedByBridgeId: "bridge-1",
      bridgeAttemptCount: 1,
    });
    const { db } = createBridgeDb({ updateRows: [[row]] });
    getDbMock.mockReturnValue(db);

    await expect(bridgeClaim("red-1", "bridge-1")).resolves.toEqual(row);
  });
});

describe("bridgeComplete", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("returns null when a failed redemption is not completed", async () => {
    const { db } = createBridgeDb({
      updateRows: [[]],
      selectRows: [[redemption({ status: "failed" })]],
    });
    getDbMock.mockReturnValue(db);

    await expect(bridgeComplete("red-1")).resolves.toBeNull();
  });

  it("returns null when a cancelled redemption is not completed", async () => {
    const { db } = createBridgeDb({
      updateRows: [[]],
      selectRows: [[redemption({ status: "cancelled" })]],
    });
    getDbMock.mockReturnValue(db);

    await expect(bridgeComplete("red-1")).resolves.toBeNull();
  });

  it("returns an already completed redemption for idempotent retries", async () => {
    const row = redemption({ status: "completed" });
    const { db } = createBridgeDb({
      updateRows: [[]],
      selectRows: [[row]],
    });
    getDbMock.mockReturnValue(db);

    await expect(bridgeComplete("red-1")).resolves.toEqual(row);
  });

  it("returns the completed redemption after a guarded transition", async () => {
    const row = redemption({
      status: "completed",
      executedAt: "2026-06-19T10:05:00.000Z",
    });
    const { db } = createBridgeDb({ updateRows: [[row]] });
    getDbMock.mockReturnValue(db);

    await expect(bridgeComplete("red-1")).resolves.toEqual(row);
  });
});

describe("bridgeFail", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("does not refund when the status transition does not happen", async () => {
    const row = redemption({ status: "failed" });
    const { db, balanceUpdateWhere, ledgerInsertValues } = createBridgeDb({
      updateRows: [[]],
      selectRows: [[row], [row]],
    });
    getDbMock.mockReturnValue(db);

    await expect(bridgeFail("red-1", "Timed out")).resolves.toEqual(row);
    expect(balanceUpdateWhere).not.toHaveBeenCalled();
    expect(ledgerInsertValues).not.toHaveBeenCalled();
  });

  it("does not refund a cancelled redemption", async () => {
    const row = redemption({ status: "cancelled" });
    const { db, balanceUpdateWhere, ledgerInsertValues } = createBridgeDb({
      updateRows: [[]],
      selectRows: [[row], [row]],
    });
    getDbMock.mockReturnValue(db);

    await expect(bridgeFail("red-1", "Timed out")).resolves.toEqual(row);
    expect(balanceUpdateWhere).not.toHaveBeenCalled();
    expect(ledgerInsertValues).not.toHaveBeenCalled();
  });

  it("refunds once when the guarded failure transition succeeds", async () => {
    const initial = redemption({ status: "executing" });
    const failed = redemption({
      status: "failed",
      failedAt: "2026-06-19T10:05:00.000Z",
      failureReason: "Timed out",
    });
    const { db, balanceUpdateWhere, ledgerInsertValues } = createBridgeDb({
      updateRows: [[failed]],
      selectRows: [[initial], [failed]],
    });
    getDbMock.mockReturnValue(db);

    await expect(bridgeFail("red-1", "Timed out")).resolves.toEqual(failed);
    expect(balanceUpdateWhere).toHaveBeenCalledTimes(1);
    expect(ledgerInsertValues).toHaveBeenCalledTimes(1);
    expect(ledgerInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        externalEventId: "redemption_refund:red-1",
      }),
    );
  });
});

describe("demo bridge transitions", () => {
  beforeEach(() => {
    vi.resetModules();
    getDbMock.mockReset();
    getDbMock.mockReturnValue(null);
    delete (globalThis as typeof globalThis & { __lojaDemoStore?: unknown }).__lojaDemoStore;
  });

  it("refunds a failed redemption exactly once", async () => {
    vi.doMock("@/lib/env", () => ({
      isDemoMode: true,
      adminEmails: new Set(["admin@example.com"]),
      env: {},
    }));

    const { bridgeFail: demoBridgeFail } = await import("@/lib/db/repository");

    const first = await demoBridgeFail("red_2", "Timed out");
    const storeAfterFirst = (globalThis as typeof globalThis & {
      __lojaDemoStore?: {
        balances: Array<{ viewerId: string; currentBalance: number }>;
        ledger: Array<{ kind: string; externalEventId: string | null }>;
      };
    }).__lojaDemoStore;
    const balanceAfterFirst =
      storeAfterFirst?.balances.find((entry) => entry.viewerId === "viewer_caio")?.currentBalance;
    const refundCountAfterFirst =
      storeAfterFirst?.ledger.filter((entry) => entry.kind === "redemption_refund").length ?? 0;

    const second = await demoBridgeFail("red_2", "Timed out again");
    const storeAfterSecond = (globalThis as typeof globalThis & {
      __lojaDemoStore?: {
        balances: Array<{ viewerId: string; currentBalance: number }>;
        ledger: Array<{ kind: string; externalEventId: string | null }>;
      };
    }).__lojaDemoStore;
    const balanceAfterSecond =
      storeAfterSecond?.balances.find((entry) => entry.viewerId === "viewer_caio")?.currentBalance;
    const refundEntries =
      storeAfterSecond?.ledger.filter((entry) => entry.kind === "redemption_refund") ?? [];

    expect(first?.status).toBe("failed");
    expect(second?.status).toBe("failed");
    expect(balanceAfterSecond).toBe(balanceAfterFirst);
    expect(refundEntries).toHaveLength(refundCountAfterFirst);
    expect(refundEntries[0]?.externalEventId).toBe("redemption_refund:red_2");
  });

  it("does not complete a failed redemption", async () => {
    vi.doMock("@/lib/env", () => ({
      isDemoMode: true,
      adminEmails: new Set(["admin@example.com"]),
      env: {},
    }));

    const {
      bridgeComplete: demoBridgeComplete,
      bridgeFail: demoBridgeFail,
    } = await import("@/lib/db/repository");

    await demoBridgeFail("red_2", "Timed out");
    await expect(demoBridgeComplete("red_2")).resolves.toBeNull();

    const store = (globalThis as typeof globalThis & {
      __lojaDemoStore?: {
        redemptions: Array<{ id: string; status: string }>;
      };
    }).__lojaDemoStore;

    expect(store?.redemptions.find((entry) => entry.id === "red_2")?.status).toBe("failed");
  });
});
