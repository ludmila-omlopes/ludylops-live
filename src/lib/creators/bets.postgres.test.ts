import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, env: { CREATOR_ECONOMY_ENABLED: "true" }, adminEmails: new Set() }));
import * as schema from "@/lib/db/schema";
import type { CommunityBet } from "./bets";
import { actOnCommunityBet, createCommunityBet, listCommunityBets, placeCommunityBet } from "./bets.server";
const url = process.env.MODULE_TEST_DATABASE_URL;
describe.skipIf(!url)("community bets on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `bets_${randomUUID().replaceAll("-", "")}`;
  const balance = async (viewerId: string) => (await pool.query("SELECT current_balance, lifetime_spent FROM creator_balances WHERE creator_id='a' AND viewer_id=$1", [viewerId])).rows[0];
  const count = async (kind: string) => (await pool.query("SELECT count(*)::int FROM creator_ledger WHERE kind=$1", [kind])).rows[0].count;
  const open = () => createCommunityBet("a", "owner-a", { question: "Quem vence o chefe?", options: ["Sim", "Não"], closesInMinutes: 60 });
  const bet = (viewerId: string, target: CommunityBet, option: number, amount: number, placementId = randomUUID()) =>
    placeCommunityBet("a", viewerId, target.id, { placementId, optionId: target.options[option].id, amount });
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw new Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineConnect = false; neonConfig.pipelineTLS = false;
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, max: 8 });
    await pool.query(`CREATE TABLE users (id varchar(64) PRIMARY KEY, google_user_id varchar(128), email varchar(255), youtube_channel_id varchar(128) NOT NULL,
        youtube_display_name varchar(255) NOT NULL, youtube_handle varchar(255), avatar_url text, is_linked boolean DEFAULT false NOT NULL,
        exclude_from_ranking boolean DEFAULT false NOT NULL, created_at timestamptz DEFAULT now() NOT NULL);
      CREATE TABLE creators (id varchar(64) PRIMARY KEY, slug text, display_name text, owner_user_id varchar(64), status text NOT NULL);
      CREATE TABLE creator_modules (id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL REFERENCES creators(id), module_key varchar(64) NOT NULL,
        status varchar(32) NOT NULL, config_json jsonb DEFAULT '{}' NOT NULL, installed_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
      CREATE TABLE google_accounts (id varchar(64) PRIMARY KEY, active_viewer_id varchar(64));
      CREATE TABLE google_account_viewers (id varchar(64) PRIMARY KEY, google_account_id varchar(64) NOT NULL, viewer_id varchar(64) NOT NULL);
      CREATE TABLE economy_viewer_redirects (source_viewer_id varchar(64) PRIMARY KEY, target_viewer_id varchar(64) NOT NULL REFERENCES users(id));
      CREATE TABLE creator_balances (creator_id varchar(64) NOT NULL REFERENCES creators(id), viewer_id varchar(64) NOT NULL REFERENCES users(id),
        current_balance integer DEFAULT 0 NOT NULL CHECK (current_balance >= 0), lifetime_earned integer DEFAULT 0 NOT NULL, lifetime_spent integer DEFAULT 0 NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL, PRIMARY KEY (creator_id, viewer_id));
      CREATE TABLE creator_ledger (id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL REFERENCES creators(id), viewer_id varchar(64) NOT NULL REFERENCES users(id),
        operation_key varchar(128) NOT NULL, kind varchar(16) NOT NULL, amount integer NOT NULL, reason varchar(160) NOT NULL, refund_of varchar(64),
        created_at timestamptz DEFAULT now() NOT NULL);
      CREATE UNIQUE INDEX creator_ledger_operation_idx ON creator_ledger (creator_id, operation_key);
      CREATE TABLE bets (id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL REFERENCES creators(id), question text NOT NULL,
        option_mode varchar(32) DEFAULT 'preset' NOT NULL, status varchar(32) NOT NULL, opened_at timestamptz, closes_at timestamptz NOT NULL,
        locked_at timestamptz, resolved_at timestamptz, cancelled_at timestamptz, winning_option_id varchar(64), created_at timestamptz DEFAULT now() NOT NULL);
      CREATE TABLE bet_options (id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL REFERENCES creators(id), bet_id varchar(64) NOT NULL REFERENCES bets(id),
        label varchar(255) NOT NULL, sort_order integer DEFAULT 0 NOT NULL, pool_amount integer DEFAULT 0 NOT NULL);
      CREATE TABLE bet_entries (id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL REFERENCES creators(id), bet_id varchar(64) NOT NULL REFERENCES bets(id),
        option_id varchar(64) NOT NULL REFERENCES bet_options(id), viewer_id varchar(64) NOT NULL REFERENCES users(id), amount integer NOT NULL,
        is_house_entry boolean DEFAULT false NOT NULL, payout_amount integer, settled_at timestamptz, refunded_at timestamptz, created_at timestamptz DEFAULT now() NOT NULL);
      CREATE UNIQUE INDEX bet_entries_bet_viewer_idx ON bet_entries (bet_id, viewer_id);
      INSERT INTO users (id,youtube_channel_id,youtube_display_name) VALUES ('ana','UCana','Ana'),('lia','UClia','Lia');
      INSERT INTO creators VALUES ('a','canal-a','Canal A','owner-a','active');
      INSERT INTO creator_modules (id,creator_id,module_key,status,config_json) VALUES
        ('a-bets','a','bets','installed','{"minBet":10}'),('a-points','a','points','installed','{"currencyLabel":"cristais"}');`);
    state.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => {
    await pool.query(`TRUNCATE creator_ledger, creator_balances, bet_entries, bet_options, bets;
      INSERT INTO creator_balances (creator_id, viewer_id, current_balance, lifetime_earned) VALUES ('a','lia',100,100),('a','ana',100,100);`);
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });

  it("never spends more than the balance when bets arrive at once", async () => {
    const created = await open();
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => bet("lia", created, 0, 30)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    expect(await balance("lia")).toEqual({ current_balance: 10, lifetime_spent: 90 });
    expect((await pool.query("SELECT amount FROM bet_entries")).rows).toEqual([{ amount: 90 }]);
    expect((await pool.query("SELECT pool_amount FROM bet_options WHERE id=$1", [created.options[0].id])).rows[0].pool_amount).toBe(90);
    expect(await count("bet")).toBe(3);
  });

  it("charges a repeated placement once even when it arrives at once", async () => {
    const created = await open();
    const placementId = randomUUID();
    const results = await Promise.all(Array.from({ length: 4 }, () => bet("lia", created, 0, 30, placementId)));
    expect(results.every((result) => result.wallet.balance === 70)).toBe(true);
    expect(await balance("lia")).toEqual({ current_balance: 70, lifetime_spent: 30 });
    expect((await listCommunityBets("a", "lia")).active[0]).toMatchObject({ totalPool: 30, myEntry: { amount: 30 } });
  });

  it("rolls the debit back when the viewer switches options", async () => {
    const created = await open();
    await bet("lia", created, 0, 30);
    await expect(bet("lia", created, 1, 30)).rejects.toThrow("Você já apostou em outra opção");
    expect(await balance("lia")).toEqual({ current_balance: 70, lifetime_spent: 30 });
    expect(await count("bet")).toBe(1);
  });

  it("pays the winners once when the result is set at once", async () => {
    const created = await open();
    await bet("lia", created, 0, 30);
    await bet("ana", created, 1, 60);
    const results = await Promise.allSettled(Array.from({ length: 3 }, () => actOnCommunityBet("a", "owner-a", { betId: created.id, action: "resolve", winningOptionId: created.options[0].id })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await balance("lia")).current_balance).toBe(160);
    expect((await balance("ana")).current_balance).toBe(40);
    expect(await count("bet_payout")).toBe(1);
    expect((await listCommunityBets("a", "lia")).finished[0]).toMatchObject({ status: "resolved", myEntry: { payoutAmount: 90 } });
  });

  it("refunds every entry once when the bet is cancelled", async () => {
    const created = await open();
    await bet("lia", created, 0, 30);
    await bet("ana", created, 1, 60);
    const results = await Promise.allSettled(Array.from({ length: 3 }, () => actOnCommunityBet("a", "owner-a", { betId: created.id, action: "cancel" })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await balance("lia")).current_balance).toBe(100);
    expect((await balance("ana")).current_balance).toBe(100);
    expect(await count("bet_refund")).toBe(2);
  });
});
