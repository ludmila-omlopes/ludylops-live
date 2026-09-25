import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock, resolveCreatorMock } = vi.hoisted(() => ({ getDbMock: vi.fn(), resolveCreatorMock: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: getDbMock }));
vi.mock("@/lib/creators/tenant", () => ({ resolveCreatorFromRequest: resolveCreatorMock }));

import { CreatorAreaError } from "@/lib/creators/area-errors.server";
import { createCreatorArea } from "@/lib/creators/service";
import { creatorBranding, creatorDomains, creatorModules, creators } from "@/lib/db/schema";

const input = { displayName: "Canal da Mari", slug: "canal-da-mari" };

// This adapter models the transaction contract and unique constraint arbitration;
// it is not a substitute for PostgreSQL integration testing.
function transactionDb(failureTable?: unknown) {
  const committed: Array<{ table: unknown; value: Record<string, unknown> }> = [];
  const events: string[] = [];
  let releaseFirstInsert: (() => void) | undefined;
  let claimed = false;
  const db = {
    select: vi.fn(() => { throw new Error("Creation must not preflight the slug"); }),
    transaction: vi.fn(async (run: (tx: { insert: (table: unknown) => { values: (value: Record<string, unknown>) => Promise<void> } }) => Promise<void>) => {
      const pending: typeof committed = [];
      events.push("begin");
      try {
        await run({
          insert: (table) => ({ values: async (value) => {
            if (table === creators) {
              if (claimed) {
                releaseFirstInsert?.();
                throw new Error("Failed query: insert into creators; params: PRIVATE", {
                  cause: Object.assign(new Error("PRIVATE driver detail"), { code: "23505", constraint: "creators_slug_idx" }),
                });
              }
              claimed = true;
              if (db.holdFirstInsert) {
                await new Promise<void>((resolve) => { releaseFirstInsert = resolve; });
              }
            }
            if (table === failureTable) {
              throw new Error("Failed query: insert into creator_branding; params: PRIVATE");
            }
            pending.push({ table, value });
          } }),
        });
        committed.push(...pending);
        events.push("commit");
      } catch (error) {
        events.push("rollback");
        throw error;
      }
    }),
    holdFirstInsert: false,
  };
  getDbMock.mockReturnValue(db);
  resolveCreatorMock.mockImplementation(async () => ({ creator: committed.find((row) => row.table === creators)?.value }));
  return { db, committed, events };
}

describe("creator-area database creation", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("persists the chosen currency with the new creator's points module", async () => {
    const { committed } = transactionDb();
    await createCreatorArea("owner_1", { ...input, currencyLabel: "corações" });
    const modules = committed.find((row) => row.table === creatorModules)?.value;
    expect(modules).toEqual(expect.arrayContaining([
      expect.objectContaining({ moduleKey: "points", configJson: { currencyLabel: "corações" }, creatorId: committed[0].value.id }),
    ]));
  });

  it("lets the unique constraint arbitrate overlapping requests without exposing another owner", async () => {
    const { db, committed, events } = transactionDb();
    db.holdFirstInsert = true;
    const results = await Promise.allSettled([
      createCreatorArea("owner_1", input), createCreatorArea("owner_2", input),
    ]);
    expect(results[0]).toMatchObject({ status: "fulfilled", value: { creator: { ownerUserId: "owner_1" } } });
    expect(results[1]).toMatchObject({ status: "rejected", reason: { code: "creator_slug_exists", message: "creator_slug_exists" } });
    expect(committed).toHaveLength(3);
    expect(committed.some(row => row.table === creatorDomains)).toBe(false);
    expect(events.filter((event) => event === "commit")).toHaveLength(1);
    expect(events.filter((event) => event === "rollback")).toHaveLength(1);
    expect(db.select).not.toHaveBeenCalled();
    expect(resolveCreatorMock).toHaveBeenCalledTimes(1);
  });

  it("propagates a transaction failure for rollback and classifies it as unexpected", async () => {
    const { committed, events } = transactionDb(creatorBranding);
    await expect(createCreatorArea("owner_1", input)).rejects.toMatchObject({ code: "creator_area_unexpected" });
    expect(committed).toEqual([]);
    expect(events).toEqual(["begin", "rollback"]);
    expect(resolveCreatorMock).not.toHaveBeenCalled();
  });

  it.each(["id", "slug", "ownerUserId"])("rejects resolver fallback with a different %s after commit", async (field) => {
    const { committed, events } = transactionDb();
    resolveCreatorMock.mockImplementation(async () => ({ creator: { ...committed[0].value, [field]: "another_creator" } }));
    await expect(createCreatorArea("owner_1", input)).rejects.toMatchObject({ code: "creator_area_unexpected" });
    expect(events).toEqual(["begin", "commit"]);
  });

  it("returns a conflict on same-owner retry without recovering any tenant", async () => {
    transactionDb();
    await createCreatorArea("owner_1", input);
    await expect(createCreatorArea("owner_1", input)).rejects.toMatchObject({ code: "creator_slug_exists" });
    expect(resolveCreatorMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [null, input, "missing_creator_owner"],
    ["owner_1", { displayName: "!!!", slug: "!!!" }, "invalid_creator_slug"],
    ["owner_1", { ...input, slug: "admin" }, "creator_slug_reserved"],
  ])("rejects invalid ownership and slugs before touching the database", async (owner, draft, code) => {
    await expect(createCreatorArea(owner as string | null, draft)).rejects.toEqual(new CreatorAreaError(code as "missing_creator_owner"));
    expect(getDbMock).not.toHaveBeenCalled();
  });
});
