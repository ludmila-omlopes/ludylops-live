import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: storage.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false }));
import { getOwnedCurrency, updateOwnedCurrency } from "./currency.server";
import * as schema from "@/lib/db/schema";

// Explicit disposable database only; never loads .env or DATABASE_URL.
const url = process.env.MODULE_TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL creator currency", () => {
  let admin: Pool;
  let pool: Pool;
  const namespace = `currency_test_${randomUUID().replaceAll("-", "")}`;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") {
      throw new Error("A dedicated local modules_185_test database is required");
    }
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineTLS = false;
    neonConfig.pipelineConnect = false;
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}` });
    await pool.query(`CREATE TABLE creators (id varchar(64) PRIMARY KEY, owner_user_id varchar(64), status varchar(32));
      CREATE TABLE creator_modules (id varchar(64) PRIMARY KEY, creator_id varchar(64) REFERENCES creators(id),
        module_key varchar(64), status varchar(32), config_json jsonb NOT NULL DEFAULT '{}', updated_at timestamptz);
      INSERT INTO creators VALUES ('a','owner-a','active'), ('b','owner-b','active');
      INSERT INTO creator_modules VALUES
        ('points-a','a','points','disabled','{"currencyLabel":"gemas","other":{"amount":7}}',now()),
        ('quotes-a','a','quotes','installed','{"displayDurationSeconds":12}',now()),
        ('points-b','b','points','installed','{"currencyLabel":"estrelas"}',now());`);
    storage.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  afterAll(async () => {
    if (pool) await pool.end();
    if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); }
  });
  it("persists a name without overwriting other JSON fields, status or another community", async () => {
    await updateOwnedCurrency("owner-a", "a", { currencyLabel: "corações" });
    expect(await getOwnedCurrency("owner-a", "a")).toEqual({ currencyLabel: "corações" });
    expect(await getOwnedCurrency("owner-b", "b")).toEqual({ currencyLabel: "estrelas" });
    expect((await pool.query("SELECT status, config_json FROM creator_modules WHERE id='points-a'")).rows[0]).toEqual({
      status: "disabled", config_json: { currencyLabel: "corações", other: { amount: 7 } },
    });
    expect((await pool.query("SELECT config_json FROM creator_modules WHERE id='quotes-a'")).rows[0].config_json)
      .toEqual({ displayDurationSeconds: 12 });
  });
  it("denies cross-owner reads and writes and blocks inactive creators", async () => {
    const before = (await pool.query("SELECT config_json FROM creator_modules WHERE id='points-a'")).rows[0].config_json;
    await expect(getOwnedCurrency("owner-b", "a")).rejects.toThrow("Moeda indisponível");
    await expect(updateOwnedCurrency("owner-b", "a", { currencyLabel: "roubadas" })).rejects.toThrow("Moeda indisponível");
    await pool.query("UPDATE creators SET status='disabled' WHERE id='a'");
    await expect(updateOwnedCurrency("owner-a", "a", { currencyLabel: "outras" })).rejects.toThrow("Moeda indisponível");
    expect((await pool.query("SELECT config_json FROM creator_modules WHERE id='points-a'")).rows[0].config_json).toEqual(before);
    await pool.query("UPDATE creators SET status='active' WHERE id='a'");
  });
});
