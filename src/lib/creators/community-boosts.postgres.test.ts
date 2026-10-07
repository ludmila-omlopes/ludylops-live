import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, env: { CREATOR_ECONOMY_ENABLED: "true" }, adminEmails: new Set() }));
import * as schema from "@/lib/db/schema";
import { boostCommunityVideo } from "./videos.server";
const url = process.env.MODULE_TEST_DATABASE_URL;
describe.skipIf(!url)("community boosts on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `boosts_${randomUUID().replaceAll("-", "")}`;
  const balance = async () => (await pool.query("SELECT current_balance, lifetime_spent FROM creator_balances WHERE creator_id='a' AND viewer_id='lia'")).rows[0];
  const votes = async () => (await pool.query("SELECT total_votes FROM video_suggestions WHERE id=$1", [videoId])).rows[0].total_votes;
  const videoId = randomUUID();
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
      CREATE TABLE video_suggestions (id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL REFERENCES creators(id),
        viewer_id varchar(64) NOT NULL REFERENCES users(id), youtube_video_id varchar(32) NOT NULL, title varchar(255) NOT NULL,
        creator_name varchar(255) NOT NULL, thumbnail_url text NOT NULL, video_url text NOT NULL, reason text, status varchar(32) NOT NULL,
        total_votes integer DEFAULT 0 NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
      CREATE TABLE video_suggestion_boosts (id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL REFERENCES creators(id),
        suggestion_id varchar(64) NOT NULL REFERENCES video_suggestions(id), viewer_id varchar(64) NOT NULL REFERENCES users(id),
        amount integer NOT NULL, created_at timestamptz DEFAULT now() NOT NULL);
      INSERT INTO users (id,youtube_channel_id,youtube_display_name) VALUES ('ana','UCana','Ana'),('lia','UClia','Lia');
      INSERT INTO creators VALUES ('a','canal-a','Canal A','owner-a','active');
      INSERT INTO creator_modules (id,creator_id,module_key,status,config_json) VALUES
        ('a-videos','a','video_suggestions','installed','{}'),('a-points','a','points','installed','{"currencyLabel":"cristais"}');`);
    state.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => {
    await pool.query(`TRUNCATE creator_ledger, creator_balances, video_suggestion_boosts, video_suggestions;
      INSERT INTO creator_balances (creator_id, viewer_id, current_balance, lifetime_earned) VALUES ('a','lia',100,100);`);
    // A parameterized query is a prepared statement, which takes a single command.
    await pool.query(`INSERT INTO video_suggestions (id,creator_id,viewer_id,youtube_video_id,title,creator_name,thumbnail_url,video_url,status,total_votes)
      VALUES ($1,'a','ana','aaaaaaaaaaa','Vídeo','Canal','t','u','open',1)`, [videoId]);
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });

  it("never spends more than the balance when boosts arrive at once", async () => {
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => boostCommunityVideo("a", "lia", videoId, { boostId: randomUUID(), amount: 30 })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    expect(await balance()).toEqual({ current_balance: 10, lifetime_spent: 90 });
    expect(await votes()).toBe(91);
    expect((await pool.query("SELECT count(*)::int FROM creator_ledger WHERE kind='boost'")).rows[0].count).toBe(3);
  });

  it("charges a repeated boost once even when it arrives at once", async () => {
    const boostId = randomUUID();
    const results = await Promise.all(Array.from({ length: 4 }, () => boostCommunityVideo("a", "lia", videoId, { boostId, amount: 30 })));
    expect(results.every((result) => result.wallet.balance === 70)).toBe(true);
    expect(await balance()).toEqual({ current_balance: 70, lifetime_spent: 30 });
    expect(await votes()).toBe(31);
    expect((await pool.query("SELECT count(*)::int FROM video_suggestion_boosts")).rows[0].count).toBe(1);
  });
});
