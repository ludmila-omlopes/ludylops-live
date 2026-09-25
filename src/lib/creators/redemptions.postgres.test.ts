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
import { listCreatorCatalog, listCreatorRedemptions, saveCreatorCatalog, purchaseCreatorItem, dispatchCreatorRedemptions, getCreatorOperations, recoverCreatorRedemption } from "./redemptions.server";
import { mutateCreatorEconomy, readCreatorEconomy } from "./economy";
import { mergeCreatorEconomies } from "./economy-identity";
import { bridgePull, bridgeClaim, bridgeComplete, bridgeFail, getCatalog, listAdminRedemptions } from "@/lib/db/repository";

const url = process.env.MODULE_TEST_DATABASE_URL;
describe.skipIf(!url)("creator redemptions on PostgreSQL", () => {
  let admin: Pool, pool: Pool, db: ReturnType<typeof drizzle<typeof schema>>;
  const namespace = `redemptions_${randomUUID().replaceAll("-", "")}`;
  const item = { id: "same-local-id", revision: 0, name: "Som da live", description: "Uma vinheta", cost: 30, stock: 3, isActive: true, globalCooldownSeconds: 0, viewerCooldownSeconds: 0, streamerbotActionRef: "live-sound" };
  const buy = (creatorId = "a", operationKey = randomUUID(), viewer = "viewer") => purchaseCreatorItem(creatorId, viewer, { itemId: item.id, operationKey });
  const dispatch = (operation: string, redemptionId: string, creatorId = "a", bridgeId = "worker") => dispatchCreatorRedemptions(creatorId, {
    operation, redemptionId, bridgeId, ...(operation === "complete" ? { executionNote: "Ação aceita" } : operation === "fail" ? { failureReason: "Ação recusada" } : {}) });
  const balance = async (creatorId = "a", viewerId = "viewer") => (await readCreatorEconomy({ creatorId }, { kind: "viewer", viewerId }, viewerId)).balance;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw new Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineTLS = false; neonConfig.pipelineConnect = false;
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, max: 15 });
    // Minimal dependency tables plus the exact production migrations under test.
    await pool.query(`
      CREATE TABLE users (id varchar(64) PRIMARY KEY, youtube_channel_id varchar(128), youtube_display_name varchar(255));
      CREATE TABLE google_accounts (id varchar(64) PRIMARY KEY, active_viewer_id varchar(64));
      CREATE TABLE google_account_viewers (google_account_id varchar(64), viewer_id varchar(64));
      CREATE TABLE creators (id varchar(64) PRIMARY KEY, owner_user_id varchar(64), status varchar(32), slug varchar(64), display_name varchar(255), created_at timestamptz default now(), updated_at timestamptz default now());
      CREATE TABLE creator_modules (id varchar(64) PRIMARY KEY, creator_id varchar(64) REFERENCES creators(id), module_key varchar(64), status varchar(32), config_json jsonb NOT NULL DEFAULT '{}', installed_at timestamptz default now(), updated_at timestamptz default now());
      CREATE TABLE viewer_balances (viewer_id varchar(64) PRIMARY KEY, current_balance integer);
      CREATE TABLE point_ledger (id varchar(64), amount integer);
      INSERT INTO viewer_balances VALUES ('viewer',777); INSERT INTO point_ledger VALUES ('legacy',777);
      INSERT INTO users VALUES ('viewer','UCviewer','Pessoa'),('target','UCtarget','Destino'),('other','UCother','Outra pessoa');
      INSERT INTO creators (id,owner_user_id,status) VALUES ('a','owner-a','active'),('b','owner-b','active'),('creator_ludylops','lud','active');
      INSERT INTO creator_modules (id,creator_id,module_key,status,config_json) VALUES
        ('a-points','a','points','installed','{"currencyLabel":"cristais"}'),('b-points','b','points','installed','{"currencyLabel":"estrelas"}'),
        ('a-bot','a','streamerbot','installed','{}'),('b-bot','b','streamerbot','installed','{}'),
        ('a-redemptions','a','redemptions','installed','{}'),('b-redemptions','b','redemptions','installed','{}');
      CREATE TABLE catalog_items (id varchar(64) PRIMARY KEY, slug varchar(128), name varchar(255), description text, type varchar(64), cost integer, is_active boolean, global_cooldown_seconds integer, viewer_cooldown_seconds integer, stock integer, preview_image_url text, accent_color varchar(16), is_featured boolean, streamerbot_action_ref varchar(255), streamerbot_args_template jsonb);
      CREATE TABLE redemptions (id varchar(64) PRIMARY KEY, creator_id varchar(64), viewer_id varchar(64), catalog_item_id varchar(64), status varchar(32), cost_at_purchase integer, request_source varchar(32), idempotency_key varchar(128), bridge_attempt_count integer, claimed_by_bridge_id varchar(64), queued_at timestamptz, executed_at timestamptz, failed_at timestamptz, failure_reason text);
    `);
    for (const migration of ["0026_creator_economy", "0027_redemption_execution_audit", "0028_creator_redemptions", "0029_creator_integration_operations"]) await pool.query(readFileSync(`drizzle/${migration}.sql`, "utf8").replaceAll('"public".', `"${namespace}".`));
    db = drizzle({ client: pool, schema }); state.db.mockReturnValue(db);
  });
  beforeEach(async () => {
    state.env.CREATOR_ECONOMY_ENABLED = "true";
    await pool.query("TRUNCATE creator_redemption_resolutions, creator_bridge_status, creator_redemptions, creator_catalog_items, creator_ledger, creator_balances, economy_viewer_redirects, google_accounts, google_account_viewers; UPDATE creators SET status='active'; UPDATE creator_modules SET status='installed';");
    for (const creatorId of ["a", "b"]) {
      await saveCreatorCatalog(creatorId, `owner-${creatorId}`, { ...item, cost: creatorId === "a" ? 30 : 7 });
      await mutateCreatorEconomy({ creatorId }, { kind: "owner", viewerId: `owner-${creatorId}` }, { kind: "credit", viewerId: "viewer", amount: 100, operationKey: "seed", reason: "Teste" });
    }
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });
  const recovery = (redemptionId: string, outcome = "failed") => ({ redemptionId, outcome, expectedStatus: "executing", note: "Conferi a transmissão e a action local.", bridgeStopped: true, resultChecked: true });
  it("persists heartbeats separately per community and expires recent activity after 90 seconds", async () => {
    for (const creatorId of ["a", "b"]) await dispatchCreatorRedemptions(creatorId, { operation: "heartbeat", bridgeId: "same-worker" });
    await pool.query("UPDATE creator_bridge_status SET last_heartbeat_at=now()-interval '91 seconds' WHERE creator_id='a'");
    expect((await getCreatorOperations("a", "owner-a")).bridges).toMatchObject([{ bridgeId: "same-worker", recent: false }]);
    expect((await getCreatorOperations("b", "owner-b")).bridges[0].recent).toBe(true);
    await dispatchCreatorRedemptions("a", { operation: "heartbeat", bridgeId: "same-worker" });
    expect((await getCreatorOperations("a", "owner-a")).bridges).toHaveLength(1);
    expect((await getCreatorOperations("a", "owner-a")).bridges[0].recent).toBe(true);
    await expect(getCreatorOperations("a", "owner-b")).rejects.toThrow();
    await expect(getCreatorOperations("creator_ludylops", "lud")).rejects.toThrow();
  });
  it("serializes owner retries into one refund and one immutable audit entry", async () => {
    const { id } = await buy(); await dispatch("claim", id);
    await Promise.all(Array.from({ length: 5 }, () => recoverCreatorRedemption("a", "owner-a", recovery(id))));
    expect((await balance()).currentBalance).toBe(100);
    const data = await getCreatorOperations("a", "owner-a"); expect(data.pending).toEqual([]);
    expect(data.resolutions).toHaveLength(1); expect(data.resolutions[0]).toMatchObject({ redemptionId: id, ownerViewerId: "owner-a", outcome: "failed" });
    expect((await pool.query("SELECT * FROM creator_ledger WHERE kind='refund'")).rows).toHaveLength(1);
    expect((await listCreatorCatalog("a", { kind: "public" })).items[0].stock).toBe(2);
    await expect(recoverCreatorRedemption("a", "owner-a", { ...recovery(id), note: "Tentativa de alterar o registro" })).rejects.toThrow("diferente");
    expect((await getCreatorOperations("b", "owner-b")).resolutions).toEqual([]);
  });
  it("records observed completion without re-execution or refund, then accepts a matching delayed bridge receipt", async () => {
    const { id } = await buy(); await dispatch("claim", id);
    await recoverCreatorRedemption("a", "owner-a", recovery(id, "completed"));
    await dispatch("complete", id); expect((await balance()).currentBalance).toBe(70);
    expect((await listCreatorRedemptions("a", { kind: "owner", viewerId: "owner-a" }))[0]).toMatchObject({ status: "completed", bridgeAttemptCount: 1, executionNote: recovery(id).note });
    expect(await dispatch("claim", id)).toBeNull();
    await expect(dispatch("fail", id)).rejects.toThrow("finalizado");
  });
  it("resolves concurrent bridge completion versus owner failure without contradictory terminal states", async () => {
    const { id } = await buy(); await dispatch("claim", id);
    const outcomes = await Promise.allSettled([dispatch("complete", id), recoverCreatorRedemption("a", "owner-a", recovery(id))]);
    expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const row = (await listCreatorRedemptions("a", { kind: "owner", viewerId: "owner-a" }))[0];
    expect((await balance()).currentBalance).toBe(row.status === "failed" ? 100 : 70);
    expect((await getCreatorOperations("a", "owner-a")).resolutions).toHaveLength(row.status === "failed" ? 1 : 0);
  });
  it("rolls back both audit and refund on persistence failure", async () => {
    const { id } = await buy(); await dispatch("claim", id);
    await pool.query("ALTER TABLE creator_ledger ADD CONSTRAINT block_manual_refund CHECK (kind <> 'refund')");
    try { await expect(recoverCreatorRedemption("a", "owner-a", recovery(id))).rejects.toThrow(); }
    finally { await pool.query("ALTER TABLE creator_ledger DROP CONSTRAINT block_manual_refund"); }
    const data = await getCreatorOperations("a", "owner-a"); expect(data.resolutions).toEqual([]); expect(data.pending[0].status).toBe("executing");
    expect((await balance()).currentBalance).toBe(70);
  });
  it("rejects cross-owner/creator recovery, queued items, forged identity and missing acknowledgements", async () => {
    const { id } = await buy();
    await expect(recoverCreatorRedemption("a", "owner-a", recovery(id))).rejects.toThrow("estado");
    await dispatch("claim", id);
    await expect(recoverCreatorRedemption("a", "owner-b", recovery(id))).rejects.toThrow();
    await expect(recoverCreatorRedemption("b", "owner-b", recovery(id))).rejects.toThrow();
    await expect(recoverCreatorRedemption("a", "owner-a", { ...recovery(id), creatorId: "b" })).rejects.toThrow();
    await expect(recoverCreatorRedemption("a", "owner-a", { ...recovery(id), bridgeStopped: false })).rejects.toThrow();
    await pool.query("UPDATE creator_modules SET status='disabled' WHERE id='a-bot'");
    await expect(recoverCreatorRedemption("a", "owner-a", recovery(id))).rejects.toThrow();
    await pool.query("UPDATE creator_modules SET status='installed'; UPDATE creators SET status='disabled' WHERE id='a'");
    await expect(recoverCreatorRedemption("a", "owner-a", recovery(id))).rejects.toThrow();
    expect((await pool.query("SELECT * FROM creator_redemption_resolutions")).rows).toEqual([]);
  });
  it("serializes stock and balance, deduplicates concurrent retries and isolates the same item/key", async () => {
    const key = randomUUID();
    const repeated = await Promise.all(Array.from({ length: 6 }, () => buy("a", key)));
    expect(repeated.filter((r) => !r.duplicate)).toHaveLength(1);
    await buy("b", key);
    const burst = await Promise.allSettled(Array.from({ length: 5 }, () => buy()));
    expect(burst.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect((await balance()).currentBalance).toBe(10); expect((await balance("b")).currentBalance).toBe(93);
    expect((await listCreatorCatalog("a", { kind: "public" })).items[0].stock).toBe(0);
    expect((await listCreatorCatalog("b", { kind: "public" })).items[0].stock).toBe(2);
    await expect(buy("a", key, "other")).rejects.toThrow("outro resgate");
  });
  it("rolls back insufficient funds and a database failure after debit/stock changes", async () => {
    await expect(buy("a", randomUUID(), "other")).rejects.toThrow("Saldo insuficiente");
    expect((await pool.query("SELECT * FROM creator_balances WHERE viewer_id='other'")).rows).toHaveLength(0);
    await pool.query("ALTER TABLE creator_redemptions ADD CONSTRAINT simulate_failure CHECK (cost_at_purchase < 20)");
    try { await expect(buy()).rejects.toThrow(); } finally { await pool.query("ALTER TABLE creator_redemptions DROP CONSTRAINT simulate_failure"); }
    expect((await balance()).currentBalance).toBe(100);
    expect((await listCreatorCatalog("a", { kind: "public" })).items[0].stock).toBe(3);
    expect((await pool.query("SELECT * FROM creator_ledger WHERE kind='redemption'")).rows).toHaveLength(0);
  });
  it("enforces cooldowns under concurrent requests and rejects stale owner stock edits", async () => {
    await saveCreatorCatalog("a", "owner-a", { ...item, revision: 1, globalCooldownSeconds: 60 });
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => buy()));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(saveCreatorCatalog("a", "owner-a", { ...item, revision: 2 })).rejects.toThrow("mudou");
    await buy("b");
  });
  it("claims only once; completes idempotently with an immutable action and audit record", async () => {
    const { id } = await buy();
    await saveCreatorCatalog("a", "owner-a", { ...item, revision: 2, name: "Editado", cost: 90, streamerbotActionRef: "different" });
    const queue = await dispatchCreatorRedemptions("a", { operation: "pull", bridgeId: "worker" });
    expect(queue).toMatchObject([{ id, item: { streamerbotActionRef: "live-sound" }, costAtPurchase: 30 }]);
    const claims = await Promise.all(Array.from({ length: 6 }, () => dispatch("claim", id)));
    expect(claims.filter(Boolean)).toHaveLength(1);
    await expect(dispatch("complete", id, "b")).rejects.toThrow();
    await expect(dispatch("complete", id, "a", "wrong-worker")).rejects.toThrow();
    await dispatch("complete", id);
    const before = await listCreatorRedemptions("a", { kind: "owner", viewerId: "owner-a" });
    await dispatchCreatorRedemptions("a", { operation: "complete", redemptionId: id, bridgeId: "worker", executionNote: "Não sobrescrever" });
    expect(await listCreatorRedemptions("a", { kind: "owner", viewerId: "owner-a" })).toEqual(before);
    expect(before[0]).toMatchObject({ itemName: "Som da live", costAtPurchase: 30, status: "completed", bridgeAttemptCount: 1, executionNote: "Ação aceita" });
    expect(before[0].claimedAt).toBeTruthy(); expect(before[0]).not.toHaveProperty("actionRef");
    await expect(dispatch("fail", id)).rejects.toThrow("finalizado");
  });
  it("refunds exactly once in the original community, even after an identity transfer", async () => {
    const { id } = await buy(); await dispatch("claim", id);
    await db.transaction((tx) => mergeCreatorEconomies(tx, "viewer", "target"));
    await Promise.all(Array.from({ length: 7 }, () => dispatch("fail", id)));
    expect(await balance("a", "target")).toMatchObject({ currentBalance: 100, lifetimeSpent: 0 });
    expect((await balance("b", "target")).currentBalance).toBe(100);
    expect((await pool.query("SELECT * FROM creator_ledger WHERE kind='refund'")).rows).toHaveLength(1);
    expect((await listCreatorCatalog("a", { kind: "public" })).items[0].stock).toBe(2);
    expect((await listCreatorRedemptions("a", { kind: "viewer", viewerId: "target" }))[0].status).toBe("failed");
    expect((await pool.query("SELECT * FROM creator_redemptions WHERE viewer_id='viewer'")).rows).toHaveLength(0);
  });
  it("rolls back failed refunds and prevents generic economy refunds of live purchases", async () => {
    const { id } = await buy(); await dispatch("claim", id);
    const row = (await pool.query("SELECT debit_id FROM creator_redemptions WHERE id=$1", [id])).rows[0];
    await expect(mutateCreatorEconomy({ creatorId: "a" }, { kind: "owner", viewerId: "owner-a" }, { kind: "refund", viewerId: "viewer", refundOf: row.debit_id, operationKey: "bypass", reason: "Teste" })).rejects.toThrow("refund_unavailable");
    await pool.query("ALTER TABLE creator_ledger ADD CONSTRAINT block_refund CHECK (kind <> 'refund')");
    try { await expect(dispatch("fail", id)).rejects.toThrow(); } finally { await pool.query("ALTER TABLE creator_ledger DROP CONSTRAINT block_refund"); }
    expect((await balance()).currentBalance).toBe(70);
    expect((await listCreatorRedemptions("a", { kind: "viewer", viewerId: "viewer" }))[0].status).toBe("executing");
    await dispatch("fail", id); expect((await balance()).currentBalance).toBe(100);
  });
  it("rejects owners, forged input, disabled modules/creators and legacy context", async () => {
    await expect(saveCreatorCatalog("a", "owner-b", { ...item, revision: 1 })).rejects.toThrow();
    await expect(purchaseCreatorItem("a", "viewer", { itemId: item.id, operationKey: randomUUID(), creatorId: "b" })).rejects.toThrow();
    await expect(listCreatorRedemptions("a", { kind: "owner", viewerId: "owner-b" })).rejects.toThrow();
    await expect(buy("creator_ludylops")).rejects.toThrow();
    await pool.query("UPDATE creator_modules SET status='disabled' WHERE id='a-bot'"); await expect(buy()).rejects.toThrow();
    await pool.query("UPDATE creators SET status='archived' WHERE id='b'"); await expect(buy("b")).rejects.toThrow();
    state.env.CREATOR_ECONOMY_ENABLED = "false"; await expect(listCreatorCatalog("a", { kind: "public" })).rejects.toThrow();
  });
  it("never exposes the new catalog or queue to legacy bridge/storage queries", async () => {
    const { id } = await buy();
    expect(await getCatalog()).toEqual([]); expect(await bridgePull()).toEqual([]); expect(await listAdminRedemptions()).toEqual([]);
    expect(await bridgeClaim(id, "legacy")).toBeNull(); expect(await bridgeComplete(id, "legacy")).toBeNull(); expect(await bridgeFail(id, "legacy")).toBeNull();
    expect((await balance()).currentBalance).toBe(70);
    expect((await pool.query("SELECT * FROM viewer_balances")).rows).toEqual([{ viewer_id: "viewer", current_balance: 777 }]);
    expect((await pool.query("SELECT * FROM point_ledger")).rows).toEqual([{ id: "legacy", amount: 777 }]);
    expect((await listCreatorRedemptions("b", { kind: "viewer", viewerId: "viewer" }))).toEqual([]);
    expect((await listCreatorRedemptions("a", { kind: "viewer", viewerId: "other" }))).toEqual([]);
  });
});
