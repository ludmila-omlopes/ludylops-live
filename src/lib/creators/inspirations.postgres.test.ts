import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, env: {}, adminEmails: new Set() }));
import * as schema from "@/lib/db/schema";
import { listCreatorSuggestions, listFeaturedCreatorSuggestions } from "@/lib/db/repository";
import { CommunityInspirationAccessError, CommunityInspirationConflictError, featureNewCommunityInspiration, listCommunityInspirations,
  listOwnedCommunityInspirations, suggestCommunityInspiration, updateCommunityInspirationStatus, voteCommunityInspiration } from "./inspirations.server";
const url = process.env.MODULE_TEST_DATABASE_URL;
const creator = (name: string) => ({ name, channelUrl: `https://www.youtube.com/@${name}` });
describe.skipIf(!url)("community inspirations on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `inspirations_${randomUUID().replaceAll("-", "")}`;
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
        installed_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
      CREATE TABLE users (id varchar(64) PRIMARY KEY, google_user_id varchar(128), email varchar(255), youtube_channel_id varchar(128) NOT NULL,
        youtube_display_name varchar(255) NOT NULL, youtube_handle varchar(255), avatar_url text, is_linked boolean DEFAULT false NOT NULL,
        exclude_from_ranking boolean DEFAULT false NOT NULL, created_at timestamptz DEFAULT now() NOT NULL);
      CREATE TABLE creator_suggestions (id varchar(64) PRIMARY KEY, creator_id varchar(64) DEFAULT 'creator_ludylops' NOT NULL REFERENCES creators(id),
        viewer_id varchar(64) NOT NULL REFERENCES users(id), slug varchar(160) NOT NULL, name varchar(255) NOT NULL, channel_url text NOT NULL,
        platform varchar(32) NOT NULL, category varchar(120), reason text, status varchar(32) NOT NULL, total_votes integer DEFAULT 0 NOT NULL,
        created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
      CREATE TABLE creator_suggestion_boosts (id varchar(64) PRIMARY KEY, creator_id varchar(64) DEFAULT 'creator_ludylops' NOT NULL REFERENCES creators(id),
        suggestion_id varchar(64) NOT NULL REFERENCES creator_suggestions(id), viewer_id varchar(64) NOT NULL REFERENCES users(id),
        amount integer NOT NULL, created_at timestamptz DEFAULT now() NOT NULL);
      INSERT INTO creators VALUES ('creator_ludylops','ludylops','Ludylops',null,'active'),('a','canal-a','Canal A','owner-a','active'),('b','canal-b','Canal B','owner-b','active');
      INSERT INTO users (id,youtube_channel_id,youtube_display_name) VALUES ('ana','UCana','Ana'),('caio','UCcaio','Caio'),('lia','UClia','Lia'),
        ('owner-a','UCownera','Dona A'),('owner-b','UCownerb','Dona B');`);
    state.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => {
    await pool.query(`UPDATE creators SET status='active'; TRUNCATE creator_modules, creator_suggestion_boosts, creator_suggestions;
      INSERT INTO creator_modules (id,creator_id,module_key) VALUES ('a-inspirations','a','creator_suggestions'),('b-inspirations','b','creator_suggestions');
      INSERT INTO creator_suggestions (id,viewer_id,slug,name,channel_url,platform,status,total_votes)
        VALUES ('legacy-open','ana','legado','Legado','https://youtube.com/@legado','youtube','open',40),
               ('legacy-featured','ana','destaque','Destaque','https://youtube.com/@destaque','youtube','featured',0);
      INSERT INTO creator_suggestion_boosts (id,suggestion_id,viewer_id,amount) VALUES ('legacy-boost','legacy-open','ana',40);`);
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });

  it("keeps each community's lists apart from the others and from Ludylops' pipetz lists", async () => {
    const a = await suggestCommunityInspiration("a", "ana", creator("Lia"));
    const b = await suggestCommunityInspiration("b", "ana", creator("Lia"));
    const featured = await featureNewCommunityInspiration("a", "owner-a", creator("Caio"));
    expect(a).toMatchObject({ votes: 1, voted: true, suggestedBy: "Ana", channelUrl: "https://youtube.com/@Lia" });
    expect(featured).toMatchObject({ status: "featured", votes: 0, suggestedBy: "Dona A" });
    expect(await listCommunityInspirations("a")).toMatchObject({ featured: [{ id: featured.id }], open: [{ id: a.id }], rejected: [] });
    expect((await listCommunityInspirations("b")).open.map((entry) => entry.id)).toEqual([b.id]);
    expect((await listCreatorSuggestions("ana", { includeFeatured: true })).map((entry) => entry.id).sort()).toEqual(["legacy-featured", "legacy-open"]);
    expect((await listFeaturedCreatorSuggestions()).map((entry) => entry.id)).toEqual(["legacy-featured"]);
  });

  it("counts one vote per person even when the same vote arrives at once", async () => {
    const created = await suggestCommunityInspiration("a", "ana", creator("Lia"));
    await Promise.all(Array.from({ length: 6 }, () => voteCommunityInspiration("a", "caio", created.id, true)));
    expect((await listCommunityInspirations("a", "caio")).open[0]).toMatchObject({ votes: 2, voted: true });
    await Promise.all(Array.from({ length: 4 }, () => voteCommunityInspiration("a", "caio", created.id, false)));
    expect((await pool.query("SELECT total_votes FROM creator_suggestions WHERE id=$1", [created.id])).rows[0].total_votes).toBe(1);
    await expect(voteCommunityInspiration("b", "lia", created.id, true)).rejects.toBeInstanceOf(CommunityInspirationAccessError);
    await expect(voteCommunityInspiration("a", "lia", "legacy-open", true)).rejects.toBeInstanceOf(CommunityInspirationAccessError);
  });

  it("accepts one of two simultaneous suggestions of the same link and enforces the per-person limit", async () => {
    const results = await Promise.allSettled([
      suggestCommunityInspiration("a", "ana", creator("Lia")),
      suggestCommunityInspiration("a", "caio", { name: "Outra", channelUrl: "https://youtube.com/@LIA" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(CommunityInspirationConflictError);
    const burst = await Promise.allSettled(["Um", "Dois", "Tres", "Quatro"].map((name) => suggestCommunityInspiration("a", "lia", creator(name))));
    expect(burst.filter((result) => result.status === "fulfilled")).toHaveLength(3);
  });

  it("lets only the owner feature, add and move creators, and keeps rejected ones private", async () => {
    const created = await suggestCommunityInspiration("a", "ana", creator("Lia"));
    await expect(updateCommunityInspirationStatus("a", "owner-b", { suggestionId: created.id, status: "featured" })).rejects.toBeInstanceOf(CommunityInspirationAccessError);
    await expect(featureNewCommunityInspiration("a", "owner-b", creator("Intrusa"))).rejects.toBeInstanceOf(CommunityInspirationAccessError);
    await expect(updateCommunityInspirationStatus("a", "owner-a", { suggestionId: "legacy-open", status: "rejected" })).rejects.toThrow();
    expect(await updateCommunityInspirationStatus("a", "owner-a", { suggestionId: created.id, status: "rejected" })).toMatchObject({ status: "rejected" });
    expect(await listCommunityInspirations("a")).toEqual({ featured: [], open: [], rejected: [] });
    expect((await listOwnedCommunityInspirations("a", "owner-a")).rejected.map((entry) => entry.id)).toEqual([created.id]);
    await expect(voteCommunityInspiration("a", "lia", created.id, true)).rejects.toBeInstanceOf(CommunityInspirationConflictError);
    expect((await pool.query("SELECT status FROM creator_suggestions WHERE id='legacy-open'")).rows[0].status).toBe("open");
  });

  it("fails closed without the module, for an inactive community and for Ludylops", async () => {
    await pool.query("UPDATE creator_modules SET status='requested' WHERE creator_id='a'");
    await expect(listCommunityInspirations("a")).rejects.toBeInstanceOf(CommunityInspirationAccessError);
    await expect(suggestCommunityInspiration("a", "ana", creator("Lia"))).rejects.toBeInstanceOf(CommunityInspirationAccessError);
    await pool.query("UPDATE creator_modules SET status='installed' WHERE creator_id='a'");
    for (const status of ["disabled", "archived"]) {
      await pool.query("UPDATE creators SET status=$1 WHERE id='a'", [status]);
      await expect(listCommunityInspirations("a")).rejects.toBeInstanceOf(CommunityInspirationAccessError);
    }
    await expect(listCommunityInspirations("creator_ludylops")).rejects.toBeInstanceOf(CommunityInspirationAccessError);
    expect((await pool.query("SELECT count(*)::int FROM creator_suggestions WHERE creator_id='a'")).rows[0].count).toBe(0);
  });
});
