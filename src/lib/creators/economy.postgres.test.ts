import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn(), env: { CREATOR_ECONOMY_ENABLED: "true" } }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, env: state.env }));
import * as schema from "@/lib/db/schema";
import { mutateCreatorEconomy, readCreatorEconomy, rewardCreatorChat } from "./economy";
import { updateOwnedChatRewards, getOwnedChatRewards } from "./chat-rewards-settings.server";
import { updateOwnedCurrency } from "./currency.server";
import { consolidateAccountEconomies, mergeCreatorEconomies } from "./economy-identity";

const url = process.env.MODULE_TEST_DATABASE_URL;
describe.skipIf(!url)("isolated currency on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const namespace = `economy_${randomUUID().replaceAll("-", "")}`;
  const owner = { kind: "owner", viewerId: "owner-a" } as const;
  const read = (creatorId = "a", viewerId = "viewer") => readCreatorEconomy({ creatorId }, { kind: "viewer", viewerId }, viewerId);
  const change = (operationKey: string, amount: number, creatorId = "a", viewerId = "viewer", kind: "credit" | "debit" = "credit") =>
    mutateCreatorEconomy({ creatorId }, { kind: "owner", viewerId: `owner-${creatorId}` }, { kind, viewerId, operationKey, amount, reason: "Teste" });
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw new Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineTLS = false; neonConfig.pipelineConnect = false;
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, max: 15 });
    await pool.query(`
      CREATE TABLE users (id varchar(64) PRIMARY KEY, youtube_channel_id varchar(128));
      CREATE TABLE google_accounts (id varchar(64) PRIMARY KEY, active_viewer_id varchar(64));
      CREATE TABLE google_account_viewers (google_account_id varchar(64), viewer_id varchar(64));
      CREATE TABLE creators (id varchar(64) PRIMARY KEY, owner_user_id varchar(64), status varchar(32),
        slug varchar(64), display_name varchar(255), created_at timestamptz default now(), updated_at timestamptz default now());
      CREATE TABLE creator_modules (id varchar(64) PRIMARY KEY, creator_id varchar(64) REFERENCES creators(id), module_key varchar(64),
        status varchar(32), config_json jsonb NOT NULL DEFAULT '{}', installed_at timestamptz default now(), updated_at timestamptz default now());
      CREATE TABLE viewer_balances (viewer_id varchar(64) PRIMARY KEY, current_balance integer);
      CREATE TABLE point_ledger (id varchar(64), amount integer);
      INSERT INTO viewer_balances VALUES ('viewer',777);
      INSERT INTO point_ledger VALUES ('old-event',777);
      INSERT INTO users VALUES ('viewer','UCabcdefghijklmnopqrstuv'),('target','UC1234567890123456789012'),('other','UCother');
      INSERT INTO creators (id,owner_user_id,status) VALUES ('a','owner-a','active'),('b','owner-b','active'),('creator_ludylops','lud','active');
      INSERT INTO creator_modules (id,creator_id,module_key,status,config_json) VALUES
        ('a-points','a','points','installed','{"currencyLabel":"cristais"}'),('b-points','b','points','installed','{"currencyLabel":"estrelas"}'),
        ('a-bot','a','streamerbot','installed','{}'),('b-bot','b','streamerbot','installed','{}');
    `);
    const migration = readFileSync("drizzle/0026_creator_economy.sql", "utf8").replaceAll('"public".', `"${namespace}".`);
    await pool.query(migration);
    db = drizzle({ client: pool, schema }); state.db.mockReturnValue(db);
  });
  beforeEach(async () => {
    state.env.CREATOR_ECONOMY_ENABLED = "true";
    await pool.query("TRUNCATE creator_ledger, creator_balances, economy_viewer_redirects, google_accounts, google_account_viewers; UPDATE creators SET status='active'; UPDATE creator_modules SET status='installed';");
  });
  afterAll(async () => {
    if (pool) await pool.end();
    if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); }
  });
  const rule = { enabled: true, amount: 7, cooldownSeconds: 60 };
  const reward = (messageId: string, creatorId = "a", viewerId = "viewer") => rewardCreatorChat({ creatorId }, { viewerId, messageId, broadcastId: "abcdefghijk" });
  it("serializes simultaneous chat messages, isolates communities and protects legacy storage", async () => {
    await updateOwnedChatRewards("owner-a", "a", rule);
    await updateOwnedChatRewards("owner-b", "b", { ...rule, amount: 11 });
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => reward(`message-${i}`)));
    expect(results.filter((r) => r.outcome === "credited")).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "cooldown")).toHaveLength(7);
    await reward("message-0", "b");
    expect((await read()).balance.currentBalance).toBe(7);
    expect((await read()).entries).toHaveLength(1);
    expect((await read("b")).balance.currentBalance).toBe(11);
    expect((await pool.query("SELECT * FROM viewer_balances")).rows).toEqual([{ viewer_id: "viewer", current_balance: 777 }]);
    expect((await pool.query("SELECT * FROM point_ledger")).rows).toEqual([{ id: "old-event", amount: 777 }]);
  });
  it("deduplicates concurrent chat retries and retains their result across config updates", async () => {
    await updateOwnedChatRewards("owner-a", "a", rule);
    const results = await Promise.all(Array.from({ length: 8 }, () => reward("same")));
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    await updateOwnedChatRewards("owner-a", "a", { ...rule, amount: 20 });
    expect(await reward("same")).toMatchObject({ duplicate: true, entry: { amount: 7 } });
    await expect(reward("same", "a", "other")).rejects.toThrow("operation_conflict");
    expect((await read()).balance.currentBalance).toBe(7);
  });
  it("retains skipped events after enabling or expiration and credits a new message with the new rate", async () => {
    await updateOwnedChatRewards("owner-a", "a", { ...rule, enabled: false });
    expect((await reward("paused")).outcome).toBe("paused");
    await updateOwnedChatRewards("owner-a", "a", rule);
    expect(await reward("paused")).toMatchObject({ duplicate: true, outcome: "paused" });
    await reward("first");
    expect((await reward("fast")).outcome).toBe("cooldown");
    await pool.query("UPDATE creator_ledger SET created_at=now()-interval '61 seconds' WHERE kind='chat_reward'");
    await updateOwnedChatRewards("owner-a", "a", { ...rule, amount: 12 });
    expect(await reward("fast")).toMatchObject({ duplicate: true, outcome: "cooldown" });
    expect((await reward("new")).entry.amount).toBe(12);
    expect((await read()).balance.currentBalance).toBe(19);
  });
  it("preserves cooldown and message receipts through a concurrent identity move", async () => {
    await updateOwnedChatRewards("owner-a", "a", rule); await reward("first");
    await Promise.all([reward("during"), db.transaction((tx) => mergeCreatorEconomies(tx, "viewer", "target"))]);
    expect(await reward("first")).toMatchObject({ duplicate: true, entry: { viewerId: "target" } });
    expect((await reward("target-message", "a", "target")).outcome).toBe("cooldown");
    expect((await read("a", "target")).balance.currentBalance).toBe(7);
    expect((await pool.query("SELECT * FROM creator_ledger WHERE viewer_id='viewer'")).rows).toHaveLength(0);
  });
  it("merges settings atomically and rejects unauthorized configuration", async () => {
    await Promise.all([updateOwnedChatRewards("owner-a", "a", rule), updateOwnedCurrency("owner-a", "a", { currencyLabel: "corações" })]);
    expect(await getOwnedChatRewards("owner-a", "a")).toEqual(rule);
    expect((await reward("first")).currencyLabel).toBe("corações");
    await expect(updateOwnedChatRewards("owner-b", "a", { ...rule, amount: 100 })).rejects.toThrow("Moeda indisponível");
    await pool.query("UPDATE creators SET status='archived' WHERE id='a'");
    await expect(updateOwnedChatRewards("owner-a", "a", rule)).rejects.toThrow("Moeda indisponível");
    await expect(reward("archived")).rejects.toThrow("economy_unavailable");
  });
  it("rolls back chat rewards on overflow and enforces feature/module gates", async () => {
    await updateOwnedChatRewards("owner-a", "a", rule);
    await pool.query("INSERT INTO creator_balances (creator_id,viewer_id,current_balance,lifetime_earned) VALUES ('a','viewer',2147483647,2147483647)");
    await expect(reward("overflow")).rejects.toThrow("balance_limit");
    expect((await pool.query("SELECT * FROM creator_ledger")).rows).toHaveLength(0);
    await pool.query("UPDATE creator_modules SET status='disabled' WHERE id='a-bot'");
    await expect(reward("bot-off")).rejects.toThrow("economy_unavailable");
    state.env.CREATOR_ECONOMY_ENABLED = "false";
    await expect(reward("gate-off")).rejects.toThrow("economy_unavailable");
  });
  it("keeps two currencies separate, including identical event keys, without touching pipetz", async () => {
    await change("same-event", 100); await change("same-event", 20, "b"); await change("spend", 30, "a", "viewer", "debit");
    expect((await read()).balance.currentBalance).toBe(70);
    expect((await read("b")).balance.currentBalance).toBe(20);
    expect((await read()).entries.map((e) => e.creatorId)).toEqual(["a", "a"]);
    await pool.query(`UPDATE creator_modules SET config_json='{"currencyLabel":"gemas"}' WHERE id='a-points'`);
    expect(await read()).toMatchObject({ currencyLabel: "gemas", balance: { currentBalance: 70 } });
    expect((await pool.query("SELECT * FROM viewer_balances")).rows).toEqual([{ viewer_id: "viewer", current_balance: 777 }]);
    expect((await pool.query("SELECT * FROM point_ledger")).rows).toEqual([{ id: "old-event", amount: 777 }]);
  });
  it("credits a concurrent retry exactly once and rejects changed payloads", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => change("retry", 50)));
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect((await read()).balance.currentBalance).toBe(50);
    await expect(change("retry", 60)).rejects.toThrow("operation_conflict");
    await expect(change("retry", 50, "a", "other")).rejects.toThrow("operation_conflict");
  });
  it("does not overdraw under concurrent debits; failed operations leave no ledger entry", async () => {
    await change("initial", 100);
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => change(`debit-${i}`, 30, "a", "viewer", "debit")));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect((await read()).balance).toEqual({ currentBalance: 10, lifetimeEarned: 100, lifetimeSpent: 90 });
    expect((await read()).entries).toHaveLength(4);
  });
  it("refunds only the original community/viewer debit, once, with retry support", async () => {
    await change("initial", 80);
    const debit = await change("debit", 40, "a", "viewer", "debit");
    const refund = { kind: "refund", viewerId: "viewer", operationKey: "refund", refundOf: debit.entry.id, reason: "Estorno" };
    await expect(mutateCreatorEconomy({ creatorId: "b" }, { kind: "owner", viewerId: "owner-b" }, refund)).rejects.toThrow("refund_unavailable");
    await expect(mutateCreatorEconomy({ creatorId: "a" }, owner, { ...refund, viewerId: "other" })).rejects.toThrow("refund_unavailable");
    const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => mutateCreatorEconomy({ creatorId: "a" }, owner, { ...refund, operationKey: `refund-${i}` })));
    const success = results.find((r) => r.status === "fulfilled")!;
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    if (success.status === "fulfilled") expect((await mutateCreatorEconomy({ creatorId: "a" }, owner, { ...refund, operationKey: success.value.entry.operationKey })).duplicate).toBe(true);
    expect((await read()).balance).toEqual({ currentBalance: 80, lifetimeEarned: 80, lifetimeSpent: 0 });
  });
  it("rejects wrong owners, viewer writes, cross-viewer reads, inactive creators/modules and legacy IDs", async () => {
    const input = { kind: "credit", viewerId: "viewer", operationKey: "x", amount: 1, reason: "x" };
    await expect(mutateCreatorEconomy({ creatorId: "b" }, owner, input)).rejects.toThrow("economy_unavailable");
    await expect(mutateCreatorEconomy({ creatorId: "a" }, { kind: "viewer", viewerId: "viewer" }, input)).rejects.toThrow("economy_unavailable");
    await expect(readCreatorEconomy({ creatorId: "a" }, { kind: "viewer", viewerId: "other" }, "viewer")).rejects.toThrow("economy_unavailable");
    await expect(change("x", 1, "creator_ludylops")).rejects.toThrow("legacy_economy_only");
    await pool.query("UPDATE creator_modules SET status='disabled' WHERE id='a-points'");
    await expect(change("x", 1)).rejects.toThrow("economy_unavailable");
    await pool.query("UPDATE creators SET status='archived' WHERE id='b'");
    await expect(read("b")).rejects.toThrow("economy_unavailable");
    expect((await pool.query("SELECT count(*)::int AS n FROM creator_ledger")).rows[0].n).toBe(0);
  });
  it("moves identities per currency and preserves concurrent credits plus event idempotency", async () => {
    await change("initial", 100); await change("initial", 20, "b"); await change("target", 5, "a", "target");
    await Promise.all([
      ...Array.from({ length: 8 }, (_, i) => change(`concurrent-${i}`, 1)),
      db.transaction((tx) => mergeCreatorEconomies(tx, "viewer", "target")),
    ]);
    expect((await read("a", "target")).balance.currentBalance).toBe(113);
    expect((await read("b", "target")).balance.currentBalance).toBe(20);
    expect((await read()).viewerId).toBe("target");
    expect((await change("initial", 100)).duplicate).toBe(true);
    expect((await pool.query("SELECT * FROM creator_balances WHERE viewer_id='viewer'")).rows).toHaveLength(0);
    expect((await pool.query("SELECT * FROM creator_ledger WHERE viewer_id='viewer'")).rows).toHaveLength(0);
    await db.transaction((tx) => mergeCreatorEconomies(tx, "target", "other"));
    expect((await read()).viewerId).toBe("other");
    expect((await read()).balance.currentBalance).toBe(113);
  });
  it("rolls back the whole identity move if its caller aborts", async () => {
    await change("initial", 10);
    await expect(db.transaction(async (tx) => { await mergeCreatorEconomies(tx, "viewer", "target"); throw new Error("abort"); })).rejects.toThrow("abort");
    expect((await read()).viewerId).toBe("viewer");
    expect((await read()).balance.currentBalance).toBe(10);
    expect((await read("a", "target")).balance.currentBalance).toBe(0);
  });
  it("honors existing linked channels and supports switching the active channel back", async () => {
    await pool.query("INSERT INTO google_accounts VALUES ('account','target'); INSERT INTO google_account_viewers VALUES ('account','viewer'),('account','target');");
    await change("existing-link", 10);
    expect((await read()).viewerId).toBe("target");
    await db.transaction(async (tx) => {
      await consolidateAccountEconomies(tx, "account", "viewer");
      await tx.execute(sql`UPDATE google_accounts SET active_viewer_id='viewer'`);
    });
    await change("back", 5);
    expect((await read()).balance.currentBalance).toBe(15);
    await db.transaction(async (tx) => {
      await consolidateAccountEconomies(tx, "account", "target");
      await tx.execute(sql`UPDATE google_accounts SET active_viewer_id='target'`);
    });
    await change("forward", 5);
    expect((await read()).viewerId).toBe("target");
    expect((await read()).balance.currentBalance).toBe(20);
  });
  it("requires explicit production activation and enforces the legacy fence in SQL", async () => {
    state.env.CREATOR_ECONOMY_ENABLED = "false";
    await expect(change("x", 1)).rejects.toThrow("economy_unavailable");
    await expect(pool.query("INSERT INTO creator_balances (creator_id,viewer_id) VALUES ('creator_ludylops','viewer')")).rejects.toThrow();
  });
});
