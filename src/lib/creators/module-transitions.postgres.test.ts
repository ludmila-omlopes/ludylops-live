import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: storage.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false }));
import {
  ModuleTransitionError,
  updatePlatformCreatorModuleStatus,
} from "./instances";
import * as schema from "@/lib/db/schema";

// Opt-in only: never reads DATABASE_URL or any .env. Requires a dedicated local database.
const url = process.env.MODULE_TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL serialized module transitions", () => {
  let admin: Pool;
  let pool: Pool;
  const namespace = `module_test_${randomUUID().replaceAll("-", "")}`;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      parsed.hostname !== "127.0.0.1" ||
      parsed.pathname !== "/modules_185_test"
    )
      throw new Error(
        "A dedicated local modules_185_test database is required",
      );
    neonConfig.webSocketConstructor = ws as NonNullable<
      typeof neonConfig.webSocketConstructor
    >;
    neonConfig.wsProxy = () =>
      `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineTLS = false;
    neonConfig.pipelineConnect = false;
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({
      connectionString: url,
      options: `-c search_path=${namespace}`,
    });
    expect(
      (await pool.query("SELECT current_schema() AS name")).rows[0].name,
    ).toBe(namespace);
    await pool.query(`CREATE TABLE creators (id varchar(64) PRIMARY KEY);
      CREATE TABLE creator_modules (
        id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL REFERENCES creators(id),
        module_key varchar(64) NOT NULL, status varchar(32) NOT NULL,
        config_json jsonb NOT NULL DEFAULT '{}', installed_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(creator_id, module_key));
      INSERT INTO creators VALUES ('target'), ('other');
      INSERT INTO creator_modules (id, creator_id, module_key, status, config_json) VALUES
        ('points_target','target','points','installed','{"currencyLabel":"custom"}'),
        ('ranking_target','target','ranking','disabled','{}'),
        ('points_other','other','points','installed','{"currencyLabel":"other"}');`);
    storage.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  afterAll(async () => {
    if (pool) await pool.end();
    if (admin) {
      await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
      await admin.end();
    }
  });
  it("serializes concurrent dependency removal and dependent enablement", async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await pool.query(
        "UPDATE creator_modules SET status = CASE WHEN module_key = 'points' THEN 'installed' ELSE 'disabled' END WHERE creator_id = 'target'",
      );
      const results = await Promise.allSettled([
        updatePlatformCreatorModuleStatus({
          creatorId: "target",
          moduleKey: "points",
          status: "disabled",
        }),
        updatePlatformCreatorModuleStatus({
          creatorId: "target",
          moduleKey: "ranking",
          status: "installed",
        }),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const rejection = results.find(
        (result) => result.status === "rejected",
      ) as PromiseRejectedResult;
      expect(rejection.reason).toBeInstanceOf(ModuleTransitionError);
      const rows = (
        await pool.query(
          "SELECT module_key, status FROM creator_modules WHERE creator_id = 'target'",
        )
      ).rows;
      expect(
        rows.some(
          (row) => row.module_key === "ranking" && row.status === "installed",
        ) &&
          rows.some(
            (row) => row.module_key === "points" && row.status !== "installed",
          ),
      ).toBe(false);
    }
  });
  it("preserves configuration, identity and other creators through rejected and successful updates", async () => {
    await pool.query(
      "UPDATE creator_modules SET status = 'installed' WHERE creator_id = 'target'",
    );
    const before = (
      await pool.query("SELECT * FROM creator_modules ORDER BY id")
    ).rows;
    await expect(
      updatePlatformCreatorModuleStatus({
        creatorId: "target",
        moduleKey: "points",
        status: "archived",
      }),
    ).rejects.toBeInstanceOf(ModuleTransitionError);
    expect(
      (await pool.query("SELECT * FROM creator_modules ORDER BY id")).rows,
    ).toEqual(before);
    await updatePlatformCreatorModuleStatus({
      creatorId: "target",
      moduleKey: "ranking",
      status: "archived",
    });
    const updated = await updatePlatformCreatorModuleStatus({
      creatorId: "target",
      moduleKey: "points",
      status: "disabled",
    });
    expect(updated).toMatchObject({
      id: "points_target",
      configJson: { currencyLabel: "custom" },
      status: "disabled",
    });
    expect(
      (
        await pool.query(
          "SELECT * FROM creator_modules WHERE creator_id = 'other'",
        )
      ).rows,
    ).toEqual(before.filter((row) => row.creator_id === "other"));
    expect(
      await updatePlatformCreatorModuleStatus({
        creatorId: "missing",
        moduleKey: "points",
        status: "installed",
      }),
    ).toBeNull();
  });
});
