import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, env: { CREATOR_ECONOMY_ENABLED: "true" }, adminEmails: new Set() }));
import * as schema from "@/lib/db/schema";
import { rewardCommunityPresence, rewardSuggestionAuthor } from "./page-rewards.server";
import { startingPageRewards } from "./page-rewards";
const url = process.env.MODULE_TEST_DATABASE_URL;
describe.skipIf(!url)("page rewards on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `page_rewards_${randomUUID().replaceAll("-", "")}`;
  const db = () => drizzle({ client: pool, schema });
  const ledger = async () => (await pool.query("SELECT creator_id, viewer_id, kind, amount, operation_key FROM creator_ledger ORDER BY operation_key")).rows;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw new Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineConnect = false; neonConfig.pipelineTLS = false;
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, max: 8 });
    await pool.query(`CREATE TABLE users (id varchar(64) PRIMARY KEY);
      CREATE TABLE creators (id varchar(64) PRIMARY KEY, owner_user_id varchar(64), status text NOT NULL);
      CREATE TABLE creator_modules (id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL REFERENCES creators(id), module_key varchar(64) NOT NULL,
        status varchar(32) NOT NULL, config_json jsonb DEFAULT '{}' NOT NULL, installed_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
      CREATE TABLE google_accounts (id varchar(64) PRIMARY KEY, active_viewer_id varchar(64));
      CREATE TABLE google_account_viewers (id varchar(64) PRIMARY KEY, google_account_id varchar(64) NOT NULL, viewer_id varchar(64) NOT NULL);
      CREATE TABLE economy_viewer_redirects (source_viewer_id varchar(64) PRIMARY KEY, target_viewer_id varchar(64) NOT NULL REFERENCES users(id));
      CREATE TABLE creator_balances (creator_id varchar(64) NOT NULL REFERENCES creators(id), viewer_id varchar(64) NOT NULL REFERENCES users(id),
        current_balance integer DEFAULT 0 NOT NULL, lifetime_earned integer DEFAULT 0 NOT NULL, lifetime_spent integer DEFAULT 0 NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL, PRIMARY KEY (creator_id, viewer_id));
      CREATE TABLE creator_ledger (id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL REFERENCES creators(id), viewer_id varchar(64) NOT NULL REFERENCES users(id),
        operation_key varchar(128) NOT NULL, kind varchar(16) NOT NULL, amount integer NOT NULL, reason varchar(160) NOT NULL, refund_of varchar(64),
        created_at timestamptz DEFAULT now() NOT NULL);
      CREATE UNIQUE INDEX creator_ledger_operation_idx ON creator_ledger (creator_id, operation_key);
      INSERT INTO users VALUES ('owner-a'),('ana'),('caio');
      INSERT INTO creators VALUES ('a','owner-a','active'),('b','owner-b','active');`);
    state.db.mockReturnValue(db());
  });
  beforeEach(async () => {
    await pool.query(`TRUNCATE creator_ledger, creator_balances, creator_modules; UPDATE creators SET status='active';
      INSERT INTO creator_modules (id,creator_id,module_key,status,config_json) VALUES ('a-points','a','points','installed',$1);`,
    [JSON.stringify({ currencyLabel: "cristais", pageRewards: startingPageRewards })]);
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });

  it("credits the daily visit once even when the same visit arrives at once", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => rewardCommunityPresence("a", "ana")));
    expect(results.filter((result) => result.credited)).toHaveLength(1);
    expect((await pool.query("SELECT current_balance FROM creator_balances WHERE creator_id='a' AND viewer_id='ana'")).rows[0].current_balance).toBe(10);
    await expect(rewardCommunityPresence("b", "ana")).rejects.toThrow();
  });

  it("credits a picked suggestion once, never the owner, and nothing without the currency", async () => {
    const pick = (creatorId: string, authorId: string, suggestionKey: string) =>
      db().transaction((tx) => rewardSuggestionAuthor(tx, { creatorId, authorId, suggestionKey, name: "Celeste" }));
    expect(await pick("a", "caio", "games:1")).toBe(true);
    expect(await pick("a", "caio", "games:1")).toBe(false);
    expect(await pick("a", "owner-a", "inspirations:2")).toBe(false);
    expect(await pick("b", "caio", "games:3")).toBe(false);
    expect(await ledger()).toEqual([{ creator_id: "a", viewer_id: "caio", kind: "suggestion_bonus", amount: 50, operation_key: "suggestion:games:1" }]);
  });
});
