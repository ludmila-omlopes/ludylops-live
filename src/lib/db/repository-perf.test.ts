import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const { getDbMock, resolveHltb } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  resolveHltb: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({ getDb: getDbMock }));
vi.mock("@/lib/env", () => ({
  get isDemoMode() { return !getDbMock(); },
  adminEmails: new Set<string>(),
  env: {},
}));
vi.mock("@/lib/howlongtobeat", () => ({ resolveHowLongToBeatGame: resolveHltb }));

import {
  gameSuggestions, gameSuggestionBoosts, videoSuggestions, videoSuggestionBoosts,
  streamerbotCounters, users,
} from "@/lib/db/schema";
import { getLeaderboard, listGameSuggestions, listAdminGameSuggestions, listVideoSuggestions } from "./repository";

const date = new Date("2020-01-01T00:00:00Z");
function suggestion(id: string, totalVotes = 100) {
  return {
    id, viewerId: "author", slug: id, name: id, title: id, totalVotes,
    status: "open", platforms: ["PC"], genres: [], psPlusAvailable: false,
    hltbId: "saved" as string | null, hltbMainStoryMinutes: 300 as number | null,
    hltbFetchedAt: date as Date | null,
    createdAt: date, updatedAt: date,
  };
}
function boost(id: string, suggestionId: string, amount: number, viewerId = "viewer-a") {
  return { id, suggestionId, viewerId, amount, createdAt: date };
}

// The real repository/serialization/HLTB decision run; only database I/O is stubbed.
function suggestionsDb(rows = [suggestion("one"), suggestion("two", 90), suggestion("empty", 80)]) {
  const boosts = [
    boost("a", "one", 11), boost("b", "two", 7), boost("c", "one", 13),
    boost("d", "missing", 999), boost("e", "one", 1000, "viewer-b"),
  ];
  const boostConditions: ReturnType<PgDialect["sqlToQuery"]>[] = [];
  const returning = vi.fn(async (): Promise<Record<string, unknown>[]> => []);
  const update = vi.fn(() => ({ set: () => ({ where: () => ({ returning }) }) }));
  const db = {
    update,
    select: () => ({
      from(table: unknown) {
        if (table === gameSuggestions || table === videoSuggestions) {
          return { orderBy: async () => rows };
        }
        if (table === gameSuggestionBoosts || table === videoSuggestionBoosts) {
          return { where: async (condition: SQL) => {
            const query = new PgDialect().sqlToQuery(condition);
            boostConditions.push(query);
            return boosts.filter((row) => row.viewerId === query.params[0]);
          } };
        }
        if (table === users) return { where: async () => [] };
        if (table === streamerbotCounters) return { where: async () => [{
          key: "game_boost_short_game", value: 200, metadata: {}, updatedAt: date,
        }] };
        throw new Error("Unexpected table");
      },
    }),
  };
  getDbMock.mockReturnValue(db);
  return { update, returning, boostConditions };
}

beforeEach(() => {
  getDbMock.mockReset().mockReturnValue(null);
  resolveHltb.mockReset();
  delete (globalThis as { __lojaDemoStore?: unknown }).__lojaDemoStore;
});
afterEach(() => {
  delete (globalThis as { __lojaDemoStore?: unknown }).__lojaDemoStore;
});

describe("bounded leaderboard", () => {
  it("caps demo reads, sorts before limiting, and keeps explicit admin reads complete", async () => {
    await getLeaderboard();
    const store = (globalThis as typeof globalThis & {
      __lojaDemoStore: { viewers: { id: string }[]; balances: { viewerId: string; currentBalance: number }[] };
    }).__lojaDemoStore;
    const viewer = store.viewers[0];
    const balance = store.balances[0];
    store.viewers = Array.from({ length: 105 }, (_, i) => ({ ...viewer, id: `v${i}` }));
    store.balances = store.viewers.map(({ id }, i) => ({ ...balance, viewerId: id, currentBalance: i }));
    expect(await getLeaderboard()).toHaveLength(100);
    expect(await getLeaderboard({ limit: null })).toHaveLength(105);
    const top = await getLeaderboard({ limit: 2 });
    expect(top).toMatchObject([{ balance: { currentBalance: 104 } }, { balance: { currentBalance: 103 } }]);
  });

  it.each([undefined, 2, null])("applies limit %s in the database query, preserving the ranking filter", async (limit) => {
    const rows = Array.from({ length: 105 }, (_, i) => ({ id: `v${i}`, currentBalance: 105 - i }));
    const limitQuery = vi.fn(async (count: number) => rows.slice(0, count));
    const query = Object.assign(Promise.resolve(rows), { limit: limitQuery });
    const where = vi.fn<(condition: SQL) => { orderBy: () => typeof query }>(
      () => ({ orderBy: () => query }),
    );
    getDbMock.mockReturnValue({ select: () => ({ from: () => ({ innerJoin: () => ({ where }) }) }) });
    const result = await getLeaderboard({ limit });
    expect(result).toEqual(rows.slice(0, limit === null ? rows.length : limit ?? 100));
    if (limit === null) expect(limitQuery).not.toHaveBeenCalled();
    else expect(limitQuery).toHaveBeenCalledWith(limit ?? 100);
    const condition = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(condition.sql).toContain('"exclude_from_ranking"');
    expect(condition.params).toEqual([false]);
  });

  it.each([0, -1, 1.5, 101, NaN, Infinity])("rejects invalid limit %s before database work", async (limit) => {
    await expect(getLeaderboard({ limit })).rejects.toThrow("invalid_leaderboard_limit");
    expect(getDbMock).not.toHaveBeenCalled();
  });
});

describe("suggestion reads", () => {
  it.each([
    ["games", listGameSuggestions], ["videos", listVideoSuggestions],
  ] as const)("groups %s boosts without mixing suggestions or viewers", async (_, read) => {
    const { boostConditions } = suggestionsDb();
    const result = await read("viewer-a");
    expect(result.map(({ id, viewerBoostTotal }) => ({ id, viewerBoostTotal }))).toEqual([
      { id: "one", viewerBoostTotal: 24 }, { id: "two", viewerBoostTotal: 7 }, { id: "empty", viewerBoostTotal: 0 },
    ]);
    expect(boostConditions[0].sql).toContain('"viewer_id"');
    expect(boostConditions[0].params).toEqual(["viewer-a"]);
    expect((await read("viewer-b"))[0].viewerBoostTotal).toBe(1000);
    expect((await read()).every((entry) => entry.viewerBoostTotal === 0)).toBe(true);
    expect(boostConditions).toHaveLength(2);
  });

  it.each([undefined, "viewer-a"])("uses saved HLTB data for viewer %s with no external calls or writes", async (viewerId) => {
    const { update } = suggestionsDb();
    const result = await listGameSuggestions(viewerId);
    expect(resolveHltb).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(result[0].howLongToBeat).toMatchObject({ id: "saved", mainStoryMinutes: 300, fetchedAt: date.toISOString() });
    expect(result[0].appliedBoostModifiers).toContainEqual(expect.objectContaining({ key: "short_game", multiplier: 2 }));
    expect(result[0].boostedScore).toBe(200);
  });

  it("keeps missing HLTB data readable without attempting a lookup", async () => {
    const row = { ...suggestion("missing"), hltbFetchedAt: null, hltbId: null, hltbMainStoryMinutes: null };
    const { update } = suggestionsDb([row]);
    expect((await listGameSuggestions())[0].howLongToBeat).toBeNull();
    expect(resolveHltb).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("retains the admin refresh batch cap and returns newly saved metadata", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => suggestion(`g${i}`, 100 - i));
    const { update, returning } = suggestionsDb(rows);
    const fetchedAt = new Date();
    resolveHltb.mockResolvedValue({ fetchedAt, match: null });
    returning.mockResolvedValue([{ ...rows[0], hltbFetchedAt: fetchedAt, hltbMainStoryMinutes: 900 }]);
    const result = await listAdminGameSuggestions();
    expect(resolveHltb).toHaveBeenCalledTimes(8);
    expect(resolveHltb).toHaveBeenCalledWith("g0", "PC");
    expect(update).toHaveBeenCalledTimes(8);
    expect(result.find((row) => row.id === "g0")?.howLongToBeat?.mainStoryMinutes).toBe(900);
    expect(result.find((row) => row.id === "g8")?.howLongToBeat?.fetchedAt).toBe(date.toISOString());
  });

  it("still returns saved suggestions when the admin HLTB request fails", async () => {
    const { update } = suggestionsDb();
    resolveHltb.mockRejectedValue(new Error("HLTB offline"));
    expect(await listAdminGameSuggestions()).toHaveLength(3);
    expect(resolveHltb).toHaveBeenCalledTimes(3);
    expect(update).not.toHaveBeenCalled();
  });

  it("skips fresh HLTB metadata even for admins", async () => {
    suggestionsDb([{ ...suggestion("fresh"), hltbFetchedAt: new Date() }]);
    await listAdminGameSuggestions();
    expect(resolveHltb).not.toHaveBeenCalled();
  });
});
