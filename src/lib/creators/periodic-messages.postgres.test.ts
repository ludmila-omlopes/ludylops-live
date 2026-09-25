import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false }));
import * as schema from "@/lib/db/schema";
import { editPeriodicMessages, getPeriodicMessages, dispatchPeriodicMessages } from "./periodic-messages.server";
import { PeriodicAccessError, PeriodicConflictError } from "./periodic-messages";
const url = process.env.MODULE_TEST_DATABASE_URL;
const owner = { kind: "owner" as const, ownerId: "owner-a" }, context = { creatorId: "a" };
const message = { text: "Lembrete da comunidade", enabled: true, intervalSeconds: 60 };
const claim = { action: "claim", isLive: true, broadcastId: "broadcast-a" };
describe.skipIf(!url)("periodic messages on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `periodic_${randomUUID().replaceAll("-", "")}`;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineConnect = false; neonConfig.pipelineTLS = false;
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, max: 8 });
    await pool.query(`CREATE TABLE creators(id varchar(64) PRIMARY KEY, slug text, display_name text, owner_user_id text, status text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE creator_modules(id varchar(64) PRIMARY KEY,creator_id varchar(64) REFERENCES creators(id),module_key text,status text,config_json jsonb DEFAULT '{}',installed_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
      INSERT INTO creators(id,slug,display_name,owner_user_id,status) VALUES ('a','a','A','owner-a','active'),('b','b','B','owner-b','active'),('creator_ludylops','ludylops','Ludylops',null,'active');
      INSERT INTO creator_modules(id,creator_id,module_key,status) VALUES ('m-a','a','streamerbot','installed'),('m-b','b','streamerbot','installed'),('m-l','creator_ludylops','streamerbot','installed');`);
    state.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => {
    await pool.query(`UPDATE creators SET status='active'; UPDATE creator_modules SET status='installed',config_json='{"unrelated":"preserve"}';`);
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });
  async function due() {
    const view = await editPeriodicMessages(context, owner, { action: "create", expectedRevision: 0, message });
    const id = view.items[0].id;
    await pool.query("UPDATE creator_modules SET config_json=jsonb_set(config_json,ARRAY['periodicMessages','runtime',$1,'nextDueAt'],'0') WHERE id='m-a'", [id]);
    return id;
  }
  it("persists only its creator's settings and never overwrites unrelated config", async () => {
    await due();
    const b = await getPeriodicMessages({ creatorId: "b" }, { kind: "owner", ownerId: "owner-b" }); expect(b.items).toEqual([]);
    expect((await pool.query("SELECT config_json FROM creator_modules WHERE id='m-a'")).rows[0].config_json.unrelated).toBe("preserve");
    await expect(getPeriodicMessages(context, { kind: "owner", ownerId: "owner-b" })).rejects.toBeInstanceOf(PeriodicAccessError);
    await expect(editPeriodicMessages(context, { kind: "admin" }, { action: "create", expectedRevision: 1, message })).rejects.toBeInstanceOf(PeriodicAccessError);
    expect((await getPeriodicMessages({ creatorId: "creator_ludylops" }, { kind: "admin" })).items).toEqual([]);
  });
  it("serializes competing edits instead of losing the first saved message", async () => {
    const results = await Promise.allSettled([1, 2].map(() => editPeriodicMessages(context, owner, { action: "create", expectedRevision: 0, message })));
    expect(results.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect((results.find((entry) => entry.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(PeriodicConflictError);
    expect((await getPeriodicMessages(context, owner)).items).toHaveLength(1);
  });
  it("grants one reservation across concurrent workers and rejects its token in another community", async () => {
    await due();
    const results = await Promise.all([dispatchPeriodicMessages(context, claim), dispatchPeriodicMessages(context, claim)]);
    const reserved = results.find((entry) => entry && "token" in entry)!;
    if (!("token" in reserved)) throw Error("Expected reservation");
    expect(results.filter(Boolean)).toHaveLength(1);
    await expect(dispatchPeriodicMessages({ creatorId: "b" }, { action: "ack", id: reserved.id, token: reserved.token, outcome: "sent" })).rejects.toBeInstanceOf(PeriodicConflictError);
    expect(await dispatchPeriodicMessages(context, { action: "confirm", id: reserved.id, token: reserved.token, broadcastId: reserved.broadcastId })).toEqual({ allowed: true });
    await dispatchPeriodicMessages(context, { action: "ack", id: reserved.id, token: reserved.token, outcome: "sent" });
    const before = await getPeriodicMessages(context, owner);
    await dispatchPeriodicMessages(context, { action: "ack", id: reserved.id, token: reserved.token, outcome: "failed", error: "retry" });
    const after = await getPeriodicMessages(context, owner);
    expect(after.items[0].lastSentAt).toBe(before.items[0].lastSentAt); expect(after.items[0].lastError).toBeNull();
  });
  it("denies disabled/archived creators and disabled modules even after a reservation", async () => {
    await due(); const reserved = await dispatchPeriodicMessages(context, claim);
    if (!reserved || !("token" in reserved)) throw Error("Expected reservation");
    for (const status of ["disabled", "archived"]) {
      await pool.query("UPDATE creators SET status=$1 WHERE id='a'", [status]);
      await expect(getPeriodicMessages(context, owner)).rejects.toBeInstanceOf(PeriodicAccessError);
      await expect(dispatchPeriodicMessages(context, claim)).rejects.toBeInstanceOf(PeriodicAccessError);
    }
    await pool.query("UPDATE creators SET status='active'; UPDATE creator_modules SET status='disabled' WHERE id='m-a'");
    expect((await getPeriodicMessages(context, owner)).items).toHaveLength(1);
    await expect(dispatchPeriodicMessages(context, { action: "confirm", id: reserved.id, token: reserved.token, broadcastId: reserved.broadcastId })).rejects.toBeInstanceOf(PeriodicAccessError);
  });
});
