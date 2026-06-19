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

import { catalogItems, pointLedger, redemptions, users, viewerBalances } from "@/lib/db/schema";
import { redeemItem } from "@/lib/db/repository";
import type { CatalogItemRecord } from "@/lib/types";

const viewerRow = {
  id: "viewer-1",
  googleUserId: null,
  email: null,
  youtubeChannelId: "yt-viewer-1",
  youtubeDisplayName: "Viewer Teste",
  youtubeHandle: "@viewerteste",
  avatarUrl: null,
  isLinked: true,
  excludeFromRanking: false,
  createdAt: new Date("2026-06-19T10:00:00.000Z"),
};

const balanceRow = {
  viewerId: viewerRow.id,
  currentBalance: 500,
  lifetimeEarned: 500,
  lifetimeSpent: 0,
  lastSyncedAt: new Date("2026-06-19T10:00:00.000Z"),
};

function catalogItem(overrides: Partial<CatalogItemRecord> = {}) {
  return {
    id: "item-1",
    slug: "item-1",
    name: "Item Teste",
    description: "Item usado em testes.",
    type: "generic_streamerbot_action",
    cost: 250,
    isActive: true,
    globalCooldownSeconds: 0,
    viewerCooldownSeconds: 0,
    stock: 1,
    previewImageUrl: null,
    accentColor: "#ff00aa",
    isFeatured: false,
    streamerbotActionRef: "test.action",
    streamerbotArgsTemplate: {},
    ...overrides,
  } satisfies CatalogItemRecord;
}

function createRedeemDb({
  item = catalogItem(),
  debitRows = [{ viewerId: viewerRow.id }],
  stockRows = [{ id: item.id }],
}: {
  item?: CatalogItemRecord;
  debitRows?: unknown[];
  stockRows?: unknown[];
} = {}) {
  const redemptionInsertValues = vi.fn(async () => undefined);
  const ledgerInsertValues = vi.fn(async () => undefined);
  const balanceUpdateReturning = vi.fn(async () => debitRows);
  const stockUpdateReturning = vi.fn(async () => stockRows);
  const catalogUpdateSet = vi.fn(() => ({
    where: vi.fn(() => ({
      returning: stockUpdateReturning,
    })),
  }));

  function selectFrom(table: unknown) {
    if (table === users) {
      return {
        where: () => ({
          limit: async () => [viewerRow],
        }),
      };
    }

    if (table === viewerBalances) {
      return {
        where: () => ({
          limit: async () => [balanceRow],
        }),
      };
    }

    if (table === redemptions) {
      return {
        where: () => ({
          orderBy: async () => [],
        }),
      };
    }

    if (table === pointLedger) {
      return {
        where: () => ({
          orderBy: async () => [],
        }),
      };
    }

    if (table === catalogItems) {
      return {
        orderBy: async () => [item],
      };
    }

    throw new Error("Unexpected select table in redeem db stub.");
  }

  const tx = {
    insert(table: unknown) {
      if (table === redemptions) {
        return {
          values: redemptionInsertValues,
        };
      }

      if (table === pointLedger) {
        return {
          values: ledgerInsertValues,
        };
      }

      throw new Error("Unexpected insert table in redeem tx stub.");
    },
    update(table: unknown) {
      if (table === viewerBalances) {
        return {
          set: () => ({
            where: () => ({
              returning: balanceUpdateReturning,
            }),
          }),
        };
      }

      if (table === catalogItems) {
        return {
          set: catalogUpdateSet,
        };
      }

      throw new Error("Unexpected update table in redeem tx stub.");
    },
  };

  const db = {
    select: () => ({
      from: selectFrom,
    }),
    async transaction<T>(callback: (txArg: typeof tx) => Promise<T>) {
      return callback(tx);
    },
  };

  return {
    db,
    redemptionInsertValues,
    ledgerInsertValues,
    balanceUpdateReturning,
    catalogUpdateSet,
    stockUpdateReturning,
  };
}

describe("redeemItem database guards", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("rejects and skips later writes when the guarded debit does not match", async () => {
    const { db, ledgerInsertValues, catalogUpdateSet } = createRedeemDb({
      debitRows: [],
    });
    getDbMock.mockReturnValue(db);

    await expect(
      redeemItem({ viewerId: viewerRow.id, itemId: "item-1", source: "web" }),
    ).rejects.toThrow("saldo_insuficiente");

    expect(ledgerInsertValues).not.toHaveBeenCalled();
    expect(catalogUpdateSet).not.toHaveBeenCalled();
  });

  it("rejects when the guarded stock decrement does not match", async () => {
    const { db, stockUpdateReturning } = createRedeemDb({
      stockRows: [],
    });
    getDbMock.mockReturnValue(db);

    await expect(
      redeemItem({ viewerId: viewerRow.id, itemId: "item-1", source: "web" }),
    ).rejects.toThrow("sem_estoque");

    expect(stockUpdateReturning).toHaveBeenCalledTimes(1);
  });

  it("creates a queued redemption and debit ledger entry when both guards match", async () => {
    const { db, ledgerInsertValues } = createRedeemDb();
    getDbMock.mockReturnValue(db);

    const result = await redeemItem({ viewerId: viewerRow.id, itemId: "item-1", source: "web" });

    expect(result).toMatchObject({
      viewerId: viewerRow.id,
      catalogItemId: "item-1",
      status: "queued",
      costAtPurchase: 250,
    });
    expect(ledgerInsertValues).toHaveBeenCalledTimes(1);
    expect(ledgerInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "redemption_debit",
        amount: -250,
      }),
    );
  });

  it("does not update stock for unlimited items", async () => {
    const { db, catalogUpdateSet } = createRedeemDb({
      item: catalogItem({ stock: null }),
    });
    getDbMock.mockReturnValue(db);

    await expect(
      redeemItem({ viewerId: viewerRow.id, itemId: "item-1", source: "web" }),
    ).resolves.toMatchObject({ status: "queued" });

    expect(catalogUpdateSet).not.toHaveBeenCalled();
  });
});
