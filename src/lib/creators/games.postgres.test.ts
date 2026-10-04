import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, env: {}, adminEmails: new Set() }));
import * as schema from "@/lib/db/schema";
import { CommunityGameAccessError, CommunityGameConflictError, listCommunityGames, listOwnedCommunityGames,
  suggestCommunityGame, updateCommunityGameStatus, voteCommunityGame } from "./games.server";
const url = process.env.MODULE_TEST_DATABASE_URL;
const details = (name: string, igdbId: number | null = null) => ({ igdbId, name, coverImageUrl: igdbId ? `https://images.igdb.com/${igdbId}.jpg` : null, releaseYear: 2017, platforms: ["PC"], genres: ["Platform"] });
const suggest = (creatorId: string, viewerId: string, name: string, igdbId: number | null = null) =>
  suggestCommunityGame(creatorId, viewerId, { details: details(name, igdbId), reason: null, howLongToBeat: null });
describe.skipIf(!url)("community games on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `games_${randomUUID().replaceAll("-", "")}`;
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
      CREATE TABLE game_suggestions (id varchar(64) PRIMARY KEY, creator_id varchar(64) DEFAULT 'creator_ludylops' NOT NULL REFERENCES creators(id),
        viewer_id varchar(64) NOT NULL REFERENCES users(id), slug varchar(160) NOT NULL, name varchar(255) NOT NULL, description text, link_url text,
        igdb_id integer, canonical_name varchar(255), cover_image_url text, release_year integer, platforms jsonb DEFAULT '[]' NOT NULL,
        genres jsonb DEFAULT '[]' NOT NULL, hltb_id varchar(32), hltb_name varchar(255), hltb_main_story_minutes integer,
        hltb_main_extra_minutes integer, hltb_completionist_minutes integer, hltb_similarity integer, hltb_fetched_at timestamptz,
        ps_plus_available boolean DEFAULT false NOT NULL, ps_plus_region varchar(16), ps_plus_tier varchar(32), ps_plus_product_id varchar(128),
        ps_plus_title_id varchar(64), ps_plus_product_url text, ps_plus_checked_at timestamptz, ps_plus_last_seen_at timestamptz,
        steam_app_id integer, steam_name varchar(255), steam_store_url text, steam_currency varchar(8), steam_initial_price integer,
        steam_final_price integer, steam_discount_percent integer, steam_is_free boolean DEFAULT false NOT NULL, steam_match_confidence varchar(32),
        steam_checked_at timestamptz, steam_last_price_at timestamptz, status varchar(32) NOT NULL, total_votes integer DEFAULT 0 NOT NULL,
        created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
      CREATE TABLE game_suggestion_boosts (id varchar(64) PRIMARY KEY, creator_id varchar(64) DEFAULT 'creator_ludylops' NOT NULL REFERENCES creators(id),
        suggestion_id varchar(64) NOT NULL REFERENCES game_suggestions(id), viewer_id varchar(64) NOT NULL REFERENCES users(id),
        amount integer NOT NULL, created_at timestamptz DEFAULT now() NOT NULL);
      INSERT INTO creators VALUES ('creator_ludylops','ludylops','Ludylops',null,'active'),('a','canal-a','Canal A','owner-a','active'),('b','canal-b','Canal B','owner-b','active');
      INSERT INTO users (id,youtube_channel_id,youtube_display_name) VALUES ('ana','UCana','Ana'),('caio','UCcaio','Caio'),('lia','UClia','Lia');`);
    state.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => {
    await pool.query(`UPDATE creators SET status='active'; TRUNCATE creator_modules, game_suggestion_boosts, game_suggestions;
      INSERT INTO creator_modules (id,creator_id,module_key) VALUES ('a-games','a','game_suggestions'),('b-games','b','game_suggestions');
      INSERT INTO game_suggestions (id,viewer_id,slug,name,igdb_id,status,total_votes) VALUES ('legacy-1','ana','hollow-knight','Hollow Knight',7346,'open',40);`);
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });

  it("keeps each community's games apart from the others and from Ludylops' game list", async () => {
    const a = await suggest("a", "ana", "Hollow Knight", 7346);
    const b = await suggest("b", "ana", "Hollow Knight", 7346);
    expect(a).toMatchObject({ name: "Hollow Knight", votes: 1, voted: true, suggestedBy: "Ana", platforms: ["PC"] });
    expect((await listCommunityGames("a")).open.map((game) => game.id)).toEqual([a.id]);
    expect((await listCommunityGames("b")).open.map((game) => game.id)).toEqual([b.id]);
    expect((await pool.query("SELECT creator_id, count(*)::int FROM game_suggestions GROUP BY creator_id ORDER BY creator_id")).rows)
      .toEqual([{ creator_id: "a", count: 1 }, { creator_id: "b", count: 1 }, { creator_id: "creator_ludylops", count: 1 }]);
    await expect(voteCommunityGame("a", "lia", "legacy-1", true)).rejects.toBeInstanceOf(CommunityGameAccessError);
  });

  it("counts one vote per person even when the same vote arrives at once", async () => {
    const created = await suggest("a", "ana", "Hollow Knight", 7346);
    await Promise.all(Array.from({ length: 6 }, () => voteCommunityGame("a", "caio", created.id, true)));
    expect((await listCommunityGames("a", "caio")).open[0]).toMatchObject({ votes: 2, voted: true });
    await Promise.all(Array.from({ length: 4 }, () => voteCommunityGame("a", "caio", created.id, false)));
    expect((await pool.query("SELECT total_votes FROM game_suggestions WHERE id=$1", [created.id])).rows[0].total_votes).toBe(1);
  });

  it("accepts one of two simultaneous suggestions of the same game and enforces the per-person limit", async () => {
    const results = await Promise.allSettled([suggest("a", "ana", "Hollow Knight", 7346), suggest("a", "caio", "Outro nome", 7346)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(CommunityGameConflictError);
    const burst = await Promise.allSettled(["Um", "Dois", "Tres", "Quatro"].map((name) => suggest("a", "lia", name)));
    expect(burst.filter((result) => result.status === "fulfilled")).toHaveLength(3);
  });

  it("lets only the owner move games and keeps rejected ones private", async () => {
    const created = await suggest("a", "ana", "Hollow Knight", 7346);
    await expect(updateCommunityGameStatus("a", "owner-b", { suggestionId: created.id, status: "accepted" })).rejects.toBeInstanceOf(CommunityGameAccessError);
    expect(await updateCommunityGameStatus("a", "owner-a", { suggestionId: created.id, status: "accepted" })).toMatchObject({ status: "accepted" });
    await expect(voteCommunityGame("a", "lia", created.id, true)).rejects.toBeInstanceOf(CommunityGameConflictError);
    await updateCommunityGameStatus("a", "owner-a", { suggestionId: created.id, status: "rejected" });
    expect(await listCommunityGames("a")).toEqual({ accepted: [], open: [], played: [], rejected: [] });
    expect((await listOwnedCommunityGames("a", "owner-a")).rejected.map((game) => game.id)).toEqual([created.id]);
    expect((await pool.query("SELECT status FROM game_suggestions WHERE id='legacy-1'")).rows[0].status).toBe("open");
  });

  it("fails closed without the module, for an inactive community and for Ludylops", async () => {
    await pool.query("UPDATE creator_modules SET status='requested' WHERE creator_id='a'");
    await expect(listCommunityGames("a")).rejects.toBeInstanceOf(CommunityGameAccessError);
    await expect(suggest("a", "ana", "Hollow Knight")).rejects.toBeInstanceOf(CommunityGameAccessError);
    await pool.query("UPDATE creator_modules SET status='installed' WHERE creator_id='a'");
    for (const status of ["disabled", "archived"]) {
      await pool.query("UPDATE creators SET status=$1 WHERE id='a'", [status]);
      await expect(listCommunityGames("a")).rejects.toBeInstanceOf(CommunityGameAccessError);
    }
    await expect(listCommunityGames("creator_ludylops")).rejects.toBeInstanceOf(CommunityGameAccessError);
  });
});
