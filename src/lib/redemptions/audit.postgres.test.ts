import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, env: {}, adminEmails: new Set() }));
import * as schema from "@/lib/db/schema";
import { bridgeClaim, bridgeComplete, bridgeFail, listAdminRedemptions } from "@/lib/db/repository";
const url = process.env.MODULE_TEST_DATABASE_URL;

describe.skipIf(!url)("redemption audit on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `audit_${randomUUID().replaceAll("-", "")}`;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineConnect = false; neonConfig.pipelineTLS = false;
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, max: 8 });
    await pool.query(`CREATE TABLE redemptions (id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL DEFAULT 'creator_ludylops',
      viewer_id varchar(64), catalog_item_id varchar(64), status varchar(32), cost_at_purchase int, request_source varchar(32),
      idempotency_key varchar(128), bridge_attempt_count int DEFAULT 0, claimed_by_bridge_id varchar(64),
      queued_at timestamptz DEFAULT now(), executed_at timestamptz, failed_at timestamptz, failure_reason text);
      CREATE TABLE users (id varchar(64) PRIMARY KEY, youtube_display_name text);
      CREATE TABLE catalog_items (id varchar(64) PRIMARY KEY, name text);
      CREATE TABLE viewer_balances (viewer_id varchar(64) PRIMARY KEY, current_balance int, last_synced_at timestamptz);
      CREATE TABLE point_ledger (id varchar(64) PRIMARY KEY, creator_id varchar(64) DEFAULT 'creator_ludylops', viewer_id varchar(64),
        kind text, amount int CHECK(amount < 999), source text, external_event_id text UNIQUE, metadata jsonb, created_at timestamptz DEFAULT now());
      INSERT INTO redemptions(id,status) VALUES ('legacy','completed');`);
    await pool.query(readFileSync("drizzle/0027_redemption_execution_audit.sql", "utf8"));
    expect((await pool.query("SELECT claimed_at,execution_note FROM redemptions WHERE id='legacy'")).rows[0]).toEqual({ claimed_at: null, execution_note: null });
    state.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => {
    await pool.query(`TRUNCATE redemptions,users,catalog_items,viewer_balances,point_ledger;
      INSERT INTO users VALUES ('viewer','Pessoa'); INSERT INTO catalog_items VALUES ('item','Som da live');
      INSERT INTO viewer_balances VALUES ('viewer',50,now());
      INSERT INTO redemptions(id,viewer_id,catalog_item_id,status,cost_at_purchase,request_source,idempotency_key)
        VALUES ('r','viewer','item','queued',10,'web','r');
      INSERT INTO redemptions(id,creator_id,viewer_id,catalog_item_id,status,cost_at_purchase,request_source,idempotency_key)
        VALUES ('other','other-creator','viewer','item','queued',20,'web','other');`);
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });

  it("records one winning claim and preserves the first completion on retry", async () => {
    const claims = await Promise.all([bridgeClaim("r", "bridge-a"), bridgeClaim("r", "bridge-b")]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const winner = claims.find(Boolean)!;
    expect(winner.claimedAt).toBeInstanceOf(Date); expect(winner.bridgeAttemptCount).toBe(1);
    const completed = await bridgeComplete("r", "Ação recebida");
    const retried = await bridgeComplete("r", "Não substituir");
    expect(retried?.executedAt).toEqual(completed?.executedAt); expect(retried?.executionNote).toBe("Ação recebida");
    expect(retried?.claimedAt).toEqual(winner.claimedAt);
  });
  it("records failure once and refunds once even with concurrent callbacks", async () => {
    await bridgeClaim("r", "bridge-a");
    await Promise.all([bridgeFail("r", "Tempo esgotado"), bridgeFail("r", "Falha repetida")]);
    const [entry] = await listAdminRedemptions();
    expect(entry.status).toBe("failed"); expect(entry.failedAt).toBeTruthy(); expect(entry.claimedAt).toBeTruthy();
    expect(entry.failureReason).toMatch(/Tempo esgotado|Falha repetida/);
    expect((await pool.query("SELECT current_balance FROM viewer_balances")).rows[0].current_balance).toBe(60);
    expect((await pool.query("SELECT * FROM point_ledger")).rows).toHaveLength(1);
    expect(await bridgeComplete("r", "Não concluir")).toBeNull();
  });
  it("rolls back the failure timestamp, reason and refund if recording the ledger fails", async () => {
    await pool.query("UPDATE redemptions SET cost_at_purchase=999 WHERE id='r'");
    await expect(bridgeFail("r", "Falha")).rejects.toThrow();
    const row = (await pool.query("SELECT status,failed_at,failure_reason FROM redemptions WHERE id='r'")).rows[0];
    expect(row).toEqual({ status: "queued", failed_at: null, failure_reason: null });
    expect((await pool.query("SELECT current_balance FROM viewer_balances")).rows[0].current_balance).toBe(50);
  });
  it("limits admin history and never reads or changes another creator's redemption", async () => {
    expect(await bridgeClaim("other", "bridge-a")).toBeNull();
    expect(await bridgeComplete("other", "Não concluir")).toBeNull(); expect(await bridgeFail("other", "Não falhar")).toBeNull();
    await pool.query(`INSERT INTO redemptions(id,viewer_id,catalog_item_id,status,cost_at_purchase,request_source,idempotency_key)
      SELECT 'r-' || n,'viewer','item','queued',10,'web','key-' || n FROM generate_series(1,105) n`);
    const entries = await listAdminRedemptions(); expect(entries).toHaveLength(100);
    expect(entries.every((entry) => entry.id !== "other" && entry.itemName === "Som da live" && entry.viewerName === "Pessoa")).toBe(true);
  });
});
