import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { mergeCommunityIdentity } from "./community-identity.server";
import { communityVoteId } from "./community-votes";
const url = process.env.MODULE_TEST_DATABASE_URL;
const tables = [["video_suggestion_boosts", "video_suggestions"], ["creator_suggestion_boosts", "creator_suggestions"], ["game_suggestion_boosts", "game_suggestions"]];
describe.skipIf(!url)("community identity merge on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `identity_${randomUUID().replaceAll("-", "")}`;
  const merge = () => drizzle({ client: pool, schema }).transaction((tx) => mergeCommunityIdentity(tx, "source", "target"));
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw new Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineConnect = false; neonConfig.pipelineTLS = false;
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, max: 4 });
    await pool.query(`CREATE TABLE users (id varchar(64) PRIMARY KEY);
      CREATE TABLE creators (id varchar(64) PRIMARY KEY, owner_user_id varchar(64) REFERENCES users(id), updated_at timestamptz DEFAULT now() NOT NULL);
      ${tables.map(([boosts, suggestions]) => `CREATE TABLE ${suggestions} (id varchar(64) PRIMARY KEY, viewer_id varchar(64) NOT NULL REFERENCES users(id), total_votes integer NOT NULL);
        CREATE TABLE ${boosts} (id varchar(64) PRIMARY KEY, suggestion_id varchar(64) NOT NULL REFERENCES ${suggestions}(id),
          viewer_id varchar(64) NOT NULL REFERENCES users(id), amount integer NOT NULL);`).join("\n")}`);
  });
  beforeEach(async () => {
    await pool.query(`TRUNCATE ${tables.flat().join(", ")}, creators, users CASCADE;
      INSERT INTO users VALUES ('source'),('target'),('other');
      INSERT INTO creators (id, owner_user_id) VALUES ('mine','source'),('theirs','other');`);
    for (const [boosts, suggestions] of tables) {
      await pool.query(`INSERT INTO ${suggestions} VALUES ('shared','other',3),('own','source',1)`);
      await pool.query(`INSERT INTO ${boosts} VALUES ($1,'shared','source',1),($2,'shared','target',1),($3,'own','source',1),('paid','shared','source',40)`,
        [communityVoteId("shared", "source"), communityVoteId("shared", "target"), communityVoteId("own", "source")]);
    }
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });

  it("moves suggestions, paid boosts and ownership, re-keys free votes and drops a duplicate vote", async () => {
    await merge();
    for (const [boosts, suggestions] of tables) {
      expect((await pool.query(`SELECT id, viewer_id, total_votes FROM ${suggestions} ORDER BY id`)).rows)
        .toEqual([{ id: "own", viewer_id: "target", total_votes: 1 }, { id: "shared", viewer_id: "other", total_votes: 2 }]);
      const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      expect((await pool.query(`SELECT id, viewer_id FROM ${boosts}`)).rows.sort(byId)).toEqual([
        { id: "paid", viewer_id: "target" },
        { id: communityVoteId("own", "target"), viewer_id: "target" },
        { id: communityVoteId("shared", "target"), viewer_id: "target" },
      ].sort(byId));
    }
    expect((await pool.query("SELECT id, owner_user_id FROM creators ORDER BY id")).rows)
      .toEqual([{ id: "mine", owner_user_id: "target" }, { id: "theirs", owner_user_id: "other" }]);
    // Nothing references the source anymore, so the identity merge can delete it.
    await pool.query("DELETE FROM users WHERE id='source'");
  });

  it("is harmless to repeat and to run for the same viewer", async () => {
    await merge();
    await merge();
    await drizzle({ client: pool, schema }).transaction((tx) => mergeCommunityIdentity(tx, "target", "target"));
    expect((await pool.query("SELECT total_votes FROM video_suggestions WHERE id='shared'")).rows[0].total_votes).toBe(2);
  });
});
