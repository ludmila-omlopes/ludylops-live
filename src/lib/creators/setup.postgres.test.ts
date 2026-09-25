import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn(), env: { STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY: "", CREATOR_ECONOMY_ENABLED: "true" } }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ env: state.env, isDemoMode: false }));
import * as schema from "@/lib/db/schema";
import { getOwnedCreatorSetup } from "./setup.server";

const url = process.env.MODULE_TEST_DATABASE_URL;

describe.skipIf(!url)("creator setup on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `credentials_${randomUUID().replaceAll("-", "")}`;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineConnect = false; neonConfig.pipelineTLS = false;
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, application_name: namespace, max: 8 });
    await pool.query(`CREATE TABLE creators(id varchar(64) PRIMARY KEY, slug text, display_name text, owner_user_id text, status text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE creator_modules(id varchar(64) PRIMARY KEY,creator_id varchar(64) REFERENCES creators(id),module_key text,status text,config_json jsonb DEFAULT '{}',installed_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
      CREATE TABLE creator_catalog_items(creator_id text, is_active boolean, stock integer); CREATE TABLE creator_redemptions(creator_id text,status text); CREATE TABLE streamerbot_credentials(id varchar(64) PRIMARY KEY, creator_id varchar(64) REFERENCES creators(id) NOT NULL, encrypted_secret text NOT NULL, status text DEFAULT 'active',created_at timestamptz DEFAULT now(),retiring_until timestamptz,revoked_at timestamptz,last_used_at timestamptz);
      INSERT INTO creators(id,slug,display_name,owner_user_id,status) VALUES ('a','a','A','owner-a','active'),('b','b','B','owner-b','active'),('creator_ludylops','ludylops','Ludylops','owner-a','active');
      INSERT INTO creator_modules(id,creator_id,module_key,status) VALUES ('m-a','a','streamerbot','installed'),('m-b','b','streamerbot','installed'),('m-l','creator_ludylops','streamerbot','installed');`);
    await pool.query("INSERT INTO creator_modules(id,creator_id,module_key,status) VALUES ('p-a','a','points','installed'),('r-a','a','redemptions','installed'),('p-b','b','points','installed'),('r-b','b','redemptions','installed')");
    state.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => {
    state.env.CREATOR_ECONOMY_ENABLED = "true";
    state.env.STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    await pool.query("DELETE FROM creator_catalog_items; DELETE FROM creator_redemptions; DELETE FROM streamerbot_credentials; UPDATE creators SET status='active'; UPDATE creators SET owner_user_id='owner-a' WHERE id='a'; UPDATE creator_modules SET status='installed'");
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });

  it("scopes facts to the session owner and excludes revoked/expired credentials", async () => {
    await pool.query("INSERT INTO streamerbot_credentials(id,creator_id,encrypted_secret,status,last_used_at,retiring_until) VALUES ('one','a','cipher','active',null,null),('old','a','cipher','retiring',now(),now()-interval '1 hour'),('other','b','cipher','active',now(),null); INSERT INTO creator_catalog_items VALUES ('b',true,null); INSERT INTO creator_redemptions VALUES ('b','completed')");
    const a=await getOwnedCreatorSetup('owner-a','a');
    expect(a.steps.find(s=>s.id==='authentication')?.state).toBe('pending');
    expect(a.steps.find(s=>s.id==='catalog')?.detail).toContain('0 item(ns)');
    expect(a.steps.find(s=>s.id==='test')?.state).toBe('verify');
    const b=await getOwnedCreatorSetup('owner-b','b'); expect(b.steps.find(s=>s.id==='test')?.state).toBe('configured');
    await expect(getOwnedCreatorSetup('owner-b','a')).rejects.toThrow(); await expect(getOwnedCreatorSetup('owner-a','creator_ludylops')).rejects.toThrow();
    expect(JSON.stringify(a)).not.toContain('cipher');
  });
  it("responds to module, economy and lifecycle changes without enabling anything", async () => {
    state.env.CREATOR_ECONOMY_ENABLED='false'; expect((await getOwnedCreatorSetup('owner-a','a')).steps.find(s=>s.id==='economy')?.state).toBe('blocked');
    state.env.CREATOR_ECONOMY_ENABLED='true'; await pool.query("UPDATE creator_modules SET status='disabled' WHERE id='m-a'");
    expect((await getOwnedCreatorSetup('owner-a','a')).steps.find(s=>s.id==='catalog')?.state).toBe('blocked');
    await pool.query("UPDATE creators SET status='archived' WHERE id='a'"); expect((await getOwnedCreatorSetup('owner-a','a')).active).toBe(false);
  });
});
