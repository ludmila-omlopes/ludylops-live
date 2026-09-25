import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn(), env: { CREATOR_ECONOMY_ENABLED: "true" } }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, env: state.env }));
import * as schema from "@/lib/db/schema";
import { readCreatorRanking } from "./ranking";
import { consolidateAccountEconomies, mergeCreatorEconomies } from "./economy-identity";
import { sql } from "drizzle-orm";

const url = process.env.MODULE_TEST_DATABASE_URL;
describe.skipIf(!url)("community ranking on PostgreSQL", () => {
  let admin: Pool, pool: Pool, db: ReturnType<typeof drizzle<typeof schema>>;
  const namespace = `ranking_${randomUUID().replaceAll("-", "")}`;
  const read = (creatorId = "a", limit = 100) => readCreatorRanking({ creatorId }, limit);
  const balance = (creator: string, viewer: string, amount: number) => pool.query(
    "INSERT INTO creator_balances (creator_id,viewer_id,current_balance,lifetime_earned) VALUES ($1,$2,$3,$3)", [creator, viewer, amount]);
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw new Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineConnect = false; neonConfig.pipelineTLS = false;
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, max: 8 });
    await pool.query(`
      CREATE TABLE users (id varchar(64) PRIMARY KEY, youtube_channel_id varchar(128), youtube_display_name varchar(255),
        youtube_handle varchar(255), exclude_from_ranking boolean DEFAULT false, email text DEFAULT 'private@example.com');
      CREATE TABLE creators (id varchar(64) PRIMARY KEY, status varchar(32));
      CREATE TABLE creator_modules (id varchar(64) PRIMARY KEY, creator_id varchar(64), module_key varchar(64), status varchar(32),
        config_json jsonb NOT NULL DEFAULT '{}', installed_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE google_accounts (id varchar(64) PRIMARY KEY, active_viewer_id varchar(64));
      CREATE TABLE google_account_viewers (google_account_id varchar(64), viewer_id varchar(64));
      CREATE TABLE viewer_balances (viewer_id varchar(64), current_balance int);
      INSERT INTO viewer_balances VALUES ('viewer',9999);
      INSERT INTO creators VALUES ('a','active'),('b','active');
      INSERT INTO creator_modules (id,creator_id,module_key,status,config_json) VALUES
        ('a-points','a','points','installed','{"currencyLabel":"cristais"}'),('a-ranking','a','ranking','installed','{}'),
        ('b-points','b','points','installed','{"currencyLabel":"estrelas"}'),('b-ranking','b','ranking','installed','{}');
    `);
    await pool.query(readFileSync("drizzle/0026_creator_economy.sql", "utf8").replaceAll('"public".', `"${namespace}".`));
    db = drizzle({ client: pool, schema }); state.db.mockReturnValue(db);
  });
  beforeEach(async () => {
    state.env.CREATOR_ECONOMY_ENABLED = "true";
    await pool.query(`TRUNCATE creator_ledger, creator_balances, economy_viewer_redirects, users, google_accounts, google_account_viewers;
      UPDATE creators SET status='active'; UPDATE creator_modules SET status='installed';
      UPDATE creator_modules SET config_json='{"currencyLabel":"cristais"}' WHERE id='a-points';
      INSERT INTO users (id,youtube_channel_id,youtube_display_name,youtube_handle,exclude_from_ranking) VALUES
        ('viewer','UCzzzzzzzzzzzzzzzzzzzzzz','Lia','@lia-live',false),('target','UCaaaaaaaaaaaaaaaaaaaaaa','Bia',null,false),
        ('hidden','UChhhhhhhhhhhhhhhhhhhhhh','Oculto',null,true),('synthetic','google_synthetic','Conta Google',null,false),
        ('zero','UC0000000000000000000000','Sem saldo',null,false);`);
  });
  afterAll(async () => {
    if (pool) await pool.end();
    if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); }
  });
  it("isolates two currencies with a minimal public projection and preserves legacy balances", async () => {
    await balance("a", "viewer", 20); await balance("b", "viewer", 90); await balance("a", "target", 10);
    expect(await read()).toEqual({ currencyLabel: "cristais", entries: [
      { position: 1, displayName: "Lia", handle: "@lia-live", currentBalance: 20 },
      { position: 2, displayName: "Bia", handle: null, currentBalance: 10 },
    ] });
    expect(await read("b")).toEqual({ currencyLabel: "estrelas", entries: [{ position: 1, displayName: "Lia", handle: "@lia-live", currentBalance: 90 }] });
    expect((await pool.query("SELECT * FROM viewer_balances")).rows).toEqual([{ viewer_id: "viewer", current_balance: 9999 }]);
  });
  it("excludes hidden, synthetic and zero-balance records before ranking and breaks ties deterministically", async () => {
    await balance("a", "viewer", 10); await balance("a", "target", 10);
    await balance("a", "hidden", 1000); await balance("a", "synthetic", 2000); await balance("a", "zero", 0);
    expect((await read("a", 1)).entries[0].displayName).toBe("Bia");
    expect((await read()).entries.map((e) => e.displayName)).toEqual(["Bia", "Lia"]);
    await pool.query("UPDATE users SET exclude_from_ranking=true WHERE id='target'");
    expect((await read()).entries.map((e) => e.displayName)).toEqual(["Lia"]);
  });
  it("caps results at 100 and does not fetch participants of another community", async () => {
    await pool.query(`INSERT INTO users (id,youtube_channel_id,youtube_display_name) SELECT 'many-'||i,'UC'||lpad(i::text,22,'0'),'Viewer '||i FROM generate_series(1,110) i;
      INSERT INTO creator_balances (creator_id,viewer_id,current_balance,lifetime_earned) SELECT 'a','many-'||i,i,i FROM generate_series(1,110) i;`);
    await balance("b", "viewer", 1_000_000);
    const result = await read();
    expect(result.entries).toHaveLength(100);
    expect(result.entries[0]).toMatchObject({ position: 1, displayName: "Viewer 110", currentBalance: 110 });
    expect(result.entries[99]).toMatchObject({ position: 100, currentBalance: 11 });
    expect((await read("a", 3)).entries).toHaveLength(3);
  });
  it("refreshes labels and checks lifecycle, modules and activation before publishing balances", async () => {
    await balance("a", "viewer", 10);
    await pool.query("UPDATE creator_modules SET config_json='{\"currencyLabel\":\"corações\"}' WHERE id='a-points'");
    expect((await read()).currencyLabel).toBe("corações");
    for (const id of ["a-ranking", "a-points"]) {
      await pool.query("UPDATE creator_modules SET status='disabled' WHERE id=$1", [id]);
      await expect(read()).rejects.toThrow("ranking_unavailable");
      await pool.query("UPDATE creator_modules SET status='installed' WHERE id=$1", [id]);
    }
    await pool.query("UPDATE creators SET status='archived' WHERE id='a'");
    await expect(read()).rejects.toThrow("ranking_unavailable");
    await expect(read("missing")).rejects.toThrow("ranking_unavailable");
    state.env.CREATOR_ECONOMY_ENABLED = "false";
    await expect(read("b")).rejects.toThrow("ranking_unavailable");
  });
  it("reads a consistent ranking during identity merges and shows the consolidated balance afterwards", async () => {
    await balance("a", "viewer", 10); await balance("a", "target", 20); await balance("b", "viewer", 70);
    const [during] = await Promise.all([read(), db.transaction((tx) => mergeCreatorEconomies(tx, "viewer", "target"))]);
    expect(during.entries.reduce((sum, e) => sum + e.currentBalance, 0)).toBe(30);
    expect((await read()).entries).toEqual([{ position: 1, displayName: "Bia", handle: null, currentBalance: 30 }]);
    expect((await read("b")).entries[0]).toMatchObject({ displayName: "Bia", currentBalance: 70 });
  });
  it("follows active-channel switches without duplicate participants", async () => {
    await balance("a", "viewer", 25);
    await pool.query("INSERT INTO google_accounts VALUES ('account','viewer'); INSERT INTO google_account_viewers VALUES ('account','viewer'),('account','target')");
    for (const target of ["target", "viewer"]) {
      await db.transaction(async (tx) => {
        await consolidateAccountEconomies(tx, "account", target);
        await tx.execute(sql`UPDATE google_accounts SET active_viewer_id=${target} WHERE id='account'`);
      });
      expect((await read()).entries).toHaveLength(1);
      expect((await read()).entries[0]).toMatchObject({ displayName: target === "viewer" ? "Lia" : "Bia", currentBalance: 25 });
    }
  });
});
