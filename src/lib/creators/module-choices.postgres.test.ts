import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, env: {} }));
import * as schema from "@/lib/db/schema";
import { getOwnedModuleChoices, ModuleChoicesAccessError, updateOwnedModuleChoices } from "./module-choices.server";
const url = process.env.MODULE_TEST_DATABASE_URL;
describe.skipIf(!url)("community module choices on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `choices_${randomUUID().replaceAll("-", "")}`;
  type Row = { status: string; config: Record<string, unknown> };
  const modules = async (creatorId = "a"): Promise<Record<string, Row>> => Object.fromEntries((await pool.query(
    "SELECT module_key, status, config_json FROM creator_modules WHERE creator_id=$1 ORDER BY module_key", [creatorId],
  )).rows.map((row) => [row.module_key, { status: row.status, config: row.config_json }]));
  const statuses = async (creatorId = "a") => Object.fromEntries(Object.entries(await modules(creatorId)).map(([key, row]) => [key, row.status]));
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw new Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineConnect = false; neonConfig.pipelineTLS = false;
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, max: 8 });
    await pool.query(`CREATE TABLE creators (id varchar(64) PRIMARY KEY, slug text, display_name text, owner_user_id text, status text);
      CREATE TABLE creator_modules (id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL REFERENCES creators(id), module_key varchar(64) NOT NULL,
        status varchar(32) DEFAULT 'installed' NOT NULL, config_json jsonb DEFAULT '{}' NOT NULL,
        installed_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL,
        CHECK (module_key <> 'ranking' OR status <> 'requested'));
      CREATE UNIQUE INDEX creator_modules_creator_module_idx ON creator_modules (creator_id, module_key);
      INSERT INTO creators VALUES ('a','canal-a','Canal A','owner-a','active'),('b','canal-b','Canal B','owner-b','active');`);
    state.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => {
    await pool.query(`UPDATE creators SET status='active'; TRUNCATE creator_modules;
      INSERT INTO creator_modules (id,creator_id,module_key,status,config_json,installed_at) VALUES
        ('a-products','a','product_recommendations','installed','{}','2026-09-01T00:00:00Z'),
        ('b-products','b','product_recommendations','installed','{}','2026-09-01T00:00:00Z');`);
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });

  it("keeps products, records the rest with their requirements and stamps only the creator's choice", async () => {
    const choices = await updateOwnedModuleChoices("owner-a", "a", { modules: ["product_recommendations", "game_suggestions", "bets"] });
    expect(choices.filter((choice) => choice.chosen).map((choice) => [choice.key, choice.state])).toEqual([
      ["product_recommendations", "active"], ["game_suggestions", "soon"], ["bets", "soon"], ["points", "soon"],
    ]);
    const rows = await modules();
    expect(Object.fromEntries(Object.entries(rows).map(([key, row]) => [key, row.status]))).toEqual({
      bets: "requested", game_suggestions: "requested", points: "requested", product_recommendations: "installed",
    });
    for (const row of Object.values(rows)) expect(typeof row.config.chosenAt).toBe("string");
    expect(rows.points.config.currencyLabel).toBe("pontos");
    expect(rows.bets.config).toMatchObject({ minBet: 10, maxOptions: 6 });
    // The kept install keeps its identity and history.
    expect((await pool.query("SELECT id, installed_at FROM creator_modules WHERE module_key='product_recommendations' AND creator_id='a'")).rows[0])
      .toEqual({ id: "a-products", installed_at: new Date("2026-09-01T00:00:00Z") });
    expect(await modules("b")).toEqual({ product_recommendations: { status: "installed", config: {} } });
    expect((await getOwnedModuleChoices("owner-a", "a")).map((choice) => choice.chosen)).toEqual(choices.map((choice) => choice.chosen));
  });

  it("removes what was left out without touching platform installs or disabled modules", async () => {
    await pool.query(`INSERT INTO creator_modules (id,creator_id,module_key,status,config_json) VALUES
      ('a-points','a','points','installed','{"currencyLabel":"cristais"}'), ('a-streamerbot','a','streamerbot','installed','{}'),
      ('a-bets','a','bets','disabled','{}'), ('a-videos','a','video_suggestions','requested','{}')`);
    await updateOwnedModuleChoices("owner-a", "a", { modules: [] });
    expect(await modules()).toEqual({
      bets: { status: "disabled", config: {} },
      points: { status: "installed", config: { currencyLabel: "cristais" } },
      streamerbot: { status: "installed", config: {} },
    });
  });

  it("upgrades a requested module that turns on alone, merging its configuration", async () => {
    await pool.query(`UPDATE creator_modules SET status='requested', config_json='{"keep":true}' WHERE id='a-products'`);
    await updateOwnedModuleChoices("owner-a", "a", { modules: ["product_recommendations"] });
    const rows = await modules();
    expect(rows.product_recommendations.status).toBe("installed");
    expect(rows.product_recommendations.config).toMatchObject({ keep: true, chosenAt: expect.any(String) });
  });

  it("rolls back every change when one write fails", async () => {
    // The CHECK above rejects a requested ranking after products were already deleted in the transaction.
    await expect(updateOwnedModuleChoices("owner-a", "a", { modules: ["ranking"] })).rejects.toThrow();
    expect(await modules()).toEqual({ product_recommendations: { status: "installed", config: {} } });
  });

  it("serializes competing saves into one consistent state", async () => {
    const choices = [["game_suggestions"], ["product_recommendations", "video_suggestions"]] as const;
    await Promise.all(choices.map((modules) => updateOwnedModuleChoices("owner-a", "a", { modules })));
    expect([
      { game_suggestions: "requested", points: "requested" },
      { points: "requested", product_recommendations: "installed", video_suggestions: "requested" },
    ]).toContainEqual(await statuses());
  });

  it("fails closed for another owner, a missing or an inactive community", async () => {
    await expect(updateOwnedModuleChoices("owner-b", "a", { modules: [] })).rejects.toBeInstanceOf(ModuleChoicesAccessError);
    await expect(getOwnedModuleChoices("owner-a", "missing")).rejects.toBeInstanceOf(ModuleChoicesAccessError);
    for (const status of ["disabled", "archived"]) {
      await pool.query("UPDATE creators SET status=$1 WHERE id='a'", [status]);
      await expect(getOwnedModuleChoices("owner-a", "a")).rejects.toBeInstanceOf(ModuleChoicesAccessError);
      await expect(updateOwnedModuleChoices("owner-a", "a", { modules: [] })).rejects.toBeInstanceOf(ModuleChoicesAccessError);
    }
    expect(await statuses()).toEqual({ product_recommendations: "installed" });
  });
});
