import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, adminEmails: new Set() }));
import { getViewerPoints } from "./repository";
import { users, viewerBalances } from "./schema";
describe("points-only viewer projection", () => {
  beforeEach(() => state.db.mockReset());
  it("reads identity and balance without consulting redemption or ledger data", async () => {
    const viewer = {
      id: "viewer",
      youtubeDisplayName: "Viewer",
      isLinked: true,
      createdAt: new Date(),
    };
    const balance = {
      viewerId: "viewer",
      currentBalance: 120,
      lifetimeEarned: 150,
      lifetimeSpent: 30,
      lastSyncedAt: new Date(),
    };
    const from = vi.fn((table) => {
      if (table !== users && table !== viewerBalances)
        throw new Error("unexpected module read");
      return {
        where: () => ({
          limit: async () => [table === users ? viewer : balance],
        }),
      };
    });
    state.db.mockReturnValue({ select: () => ({ from }) });
    expect(await getViewerPoints("viewer")).toMatchObject({
      viewer: { id: "viewer", isLinked: true },
      balance: { currentBalance: 120, lifetimeSpent: 30 },
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      users,
      viewerBalances,
    ]);
  });
  it("does not create demo balances after a storage failure", async () => {
    state.db.mockReturnValue(null);
    await expect(getViewerPoints("viewer")).rejects.toThrow(
      "database_unavailable",
    );
  });
});
