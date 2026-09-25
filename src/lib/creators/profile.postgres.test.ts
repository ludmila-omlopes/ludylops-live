import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, env: {} }));
import * as schema from "@/lib/db/schema";
import { getOwnedCreatorProfile, updateOwnedCreatorProfile, CreatorProfileAccessError, CreatorProfileConflictError } from "./profile.server";
const url = process.env.MODULE_TEST_DATABASE_URL;
describe.skipIf(!url)("community profile on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `profile_${randomUUID().replaceAll("-", "")}`;
  const read = () => getOwnedCreatorProfile("owner-a", "a");
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw new Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineConnect = false; neonConfig.pipelineTLS = false;
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, max: 8 });
    await pool.query(`CREATE TABLE creators (id varchar(64) PRIMARY KEY, slug text, display_name text, owner_user_id text, status text, updated_at timestamptz DEFAULT now());
      CREATE TABLE creator_branding (creator_id varchar(64) PRIMARY KEY REFERENCES creators(id), logo_url text, avatar_url text,
        primary_color varchar(16) DEFAULT '#c7a2e9' NOT NULL, secondary_color varchar(16) DEFAULT '#ff79c6' NOT NULL,
        background_color varchar(16) DEFAULT '#f9f9f9' NOT NULL, accent_color varchar(16) DEFAULT '#40a9ff' NOT NULL CHECK(accent_color <> '#dead00'),
        font_heading text DEFAULT 'app-display', font_body text DEFAULT 'app-body', border_radius int DEFAULT 0, theme_json jsonb DEFAULT '{}', updated_at timestamptz DEFAULT now());
      CREATE TABLE creator_domains (creator_id text, hostname text);
      CREATE TABLE creator_modules (creator_id text, config_json jsonb);
      CREATE TABLE creator_balances (creator_id text, current_balance int);
      INSERT INTO creators (id,slug,display_name,owner_user_id,status) VALUES ('a','canal-a','Canal A','owner-a','active'),('b','canal-b','Canal B','owner-b','active');
      INSERT INTO creator_domains VALUES ('a','canal-a.ludylops.live'),('b','canal-b.ludylops.live');
      INSERT INTO creator_modules VALUES ('a','{"currencyLabel":"cristais","chatRewards":{"amount":7}}');
      INSERT INTO creator_balances VALUES ('a',150),('b',42);`);
    state.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => {
    await pool.query(`UPDATE creators SET status='active',display_name=CASE id WHEN 'a' THEN 'Canal A' ELSE 'Canal B' END;
      TRUNCATE creator_branding; INSERT INTO creator_branding (creator_id,logo_url,theme_json) VALUES ('a','/keep.png','{"keep":true}'),('b',null,'{}');`);
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });
  it("persists name/colors atomically without changing domains, ownership, modules or balances", async () => {
    const expected = await read();
    const profile = { displayName: "Corações na live", primaryColor: "#102030", accentColor: "#ffaa00" };
    expect(await updateOwnedCreatorProfile("owner-a", "a", { expected, profile })).toEqual(profile); expect(await read()).toEqual(profile);
    expect((await pool.query("SELECT slug,owner_user_id,status FROM creators WHERE id='a'")).rows[0]).toEqual({ slug: "canal-a", owner_user_id: "owner-a", status: "active" });
    expect((await pool.query("SELECT logo_url,theme_json FROM creator_branding WHERE creator_id='a'")).rows[0]).toEqual({ logo_url: "/keep.png", theme_json: { keep: true } });
    expect((await pool.query("SELECT * FROM creator_balances ORDER BY creator_id")).rows).toEqual([{ creator_id: "a", current_balance: 150 }, { creator_id: "b", current_balance: 42 }]);
    expect((await pool.query("SELECT config_json FROM creator_modules")).rows[0].config_json.currencyLabel).toBe("cristais");
    expect((await pool.query("SELECT hostname FROM creator_domains WHERE creator_id='a'")).rows[0].hostname).toBe("canal-a.ludylops.live");
    expect((await getOwnedCreatorProfile("owner-b", "b")).displayName).toBe("Canal B");
  });
  it("rolls back the name when saving branding fails", async () => {
    const expected = await read();
    await expect(updateOwnedCreatorProfile("owner-a", "a", { expected, profile: { ...expected, displayName: "Do not persist", accentColor: "#dead00" } })).rejects.toThrow();
    expect(await read()).toEqual(expected);
  });
  it("allows only one of two competing edits and safely retries the winner", async () => {
    const expected = await read();
    const results = await Promise.allSettled(["Primeiro", "Segundo"].map((displayName) => updateOwnedCreatorProfile("owner-a", "a", { expected, profile: { ...expected, displayName } })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(CreatorProfileConflictError);
    const profile = await read(); expect(await updateOwnedCreatorProfile("owner-a", "a", { expected, profile })).toEqual(profile);
  });
  it("fails closed for another owner, missing or inactive creator", async () => {
    await expect(getOwnedCreatorProfile("owner-b", "a")).rejects.toBeInstanceOf(CreatorProfileAccessError);
    await expect(getOwnedCreatorProfile("owner-a", "missing")).rejects.toBeInstanceOf(CreatorProfileAccessError);
    const expected = await read();
    for (const status of ["disabled", "archived"]) {
      await pool.query("UPDATE creators SET status=$1 WHERE id='a'", [status]);
      await expect(read()).rejects.toBeInstanceOf(CreatorProfileAccessError);
      await expect(updateOwnedCreatorProfile("owner-a", "a", { expected, profile: expected })).rejects.toBeInstanceOf(CreatorProfileAccessError);
    }
  });
  it("creates a missing branding row using the same defaults as the public resolver", async () => {
    await pool.query("DELETE FROM creator_branding WHERE creator_id='a'");
    const expected = await read(); expect(expected.primaryColor).toBe("#c7a2e9");
    const profile = { ...expected, primaryColor: "#001122" };
    await updateOwnedCreatorProfile("owner-a", "a", { expected, profile });
    expect(await read()).toEqual(profile);
  });
});
