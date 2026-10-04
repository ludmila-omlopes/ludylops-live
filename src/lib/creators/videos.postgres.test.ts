import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, env: {}, adminEmails: new Set() }));
import * as schema from "@/lib/db/schema";
import { listVideoSuggestions } from "@/lib/db/repository";
import { CommunityVideoAccessError, CommunityVideoConflictError, createCommunityVideo, listCommunityVideos,
  listOwnedCommunityVideos, updateCommunityVideoStatus, voteCommunityVideo } from "./videos.server";
const url = process.env.MODULE_TEST_DATABASE_URL;
const metadata = (videoId: string) => ({ videoId, title: `Vídeo ${videoId}`, creatorName: "Canal", thumbnailUrl: "ignored", videoUrl: `https://www.youtube.com/watch?v=${videoId}` });
describe.skipIf(!url)("community videos on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `videos_${randomUUID().replaceAll("-", "")}`;
  const suggest = (creatorId: string, viewerId: string, videoId: string) => createCommunityVideo(creatorId, viewerId, { video: metadata(videoId), reason: null });
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
      CREATE TABLE video_suggestions (id varchar(64) PRIMARY KEY, creator_id varchar(64) DEFAULT 'creator_ludylops' NOT NULL REFERENCES creators(id),
        viewer_id varchar(64) NOT NULL REFERENCES users(id), youtube_video_id varchar(32) NOT NULL, title varchar(255) NOT NULL,
        creator_name varchar(255) NOT NULL, thumbnail_url text NOT NULL, video_url text NOT NULL, reason text, status varchar(32) NOT NULL,
        total_votes integer DEFAULT 0 NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL);
      CREATE TABLE video_suggestion_boosts (id varchar(64) PRIMARY KEY, creator_id varchar(64) DEFAULT 'creator_ludylops' NOT NULL REFERENCES creators(id),
        suggestion_id varchar(64) NOT NULL REFERENCES video_suggestions(id), viewer_id varchar(64) NOT NULL REFERENCES users(id),
        amount integer NOT NULL, created_at timestamptz DEFAULT now() NOT NULL);
      INSERT INTO creators VALUES ('creator_ludylops','ludylops','Ludylops',null,'active'),('a','canal-a','Canal A','owner-a','active'),('b','canal-b','Canal B','owner-b','active');
      INSERT INTO users (id,youtube_channel_id,youtube_display_name) VALUES ('ana','UCana','Ana'),('caio','UCcaio','Caio'),('lia','UClia','Lia');`);
    state.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => {
    await pool.query(`UPDATE creators SET status='active'; TRUNCATE creator_modules, video_suggestion_boosts, video_suggestions;
      INSERT INTO creator_modules (id,creator_id,module_key) VALUES ('a-videos','a','video_suggestions'),('b-videos','b','video_suggestions');
      INSERT INTO video_suggestions (id,viewer_id,youtube_video_id,title,creator_name,thumbnail_url,video_url,status,total_votes)
        VALUES ('legacy-1','ana','lllllllllll','Da Ludylops','Canal','t','u','open',40);
      INSERT INTO video_suggestion_boosts (id,suggestion_id,viewer_id,amount) VALUES ('legacy-boost','legacy-1','ana',40);`);
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });

  it("keeps each community's queue apart from the others and from Ludylops' pipetz list", async () => {
    const a = await suggest("a", "ana", "aaaaaaaaaaa");
    const b = await suggest("b", "ana", "aaaaaaaaaaa");
    expect(a).toMatchObject({ votes: 1, voted: true, suggestedBy: "Ana", thumbnailUrl: "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg" });
    expect((await listCommunityVideos("a")).open.map((video) => video.id)).toEqual([a.id]);
    expect((await listCommunityVideos("b")).open.map((video) => video.id)).toEqual([b.id]);
    const legacy = await listVideoSuggestions("ana");
    expect(legacy.map((video) => [video.id, video.viewerBoostTotal])).toEqual([["legacy-1", 40]]);
    expect((await pool.query("SELECT creator_id, count(*)::int FROM video_suggestion_boosts GROUP BY creator_id ORDER BY creator_id")).rows)
      .toEqual([{ creator_id: "a", count: 1 }, { creator_id: "b", count: 1 }, { creator_id: "creator_ludylops", count: 1 }]);
  });

  it("counts one vote per person even when the same vote arrives at once", async () => {
    const created = await suggest("a", "ana", "aaaaaaaaaaa");
    await Promise.all(Array.from({ length: 6 }, () => voteCommunityVideo("a", "caio", created.id, true)));
    await voteCommunityVideo("a", "lia", created.id, true);
    expect((await listCommunityVideos("a", "caio")).open[0]).toMatchObject({ votes: 3, voted: true });
    await Promise.all(Array.from({ length: 4 }, () => voteCommunityVideo("a", "caio", created.id, false)));
    expect((await listCommunityVideos("a", "caio")).open[0]).toMatchObject({ votes: 2, voted: false });
    expect((await pool.query("SELECT total_votes FROM video_suggestions WHERE id=$1", [created.id])).rows[0].total_votes).toBe(2);
    // A vote never reaches a video from another community, even with its ID.
    await expect(voteCommunityVideo("b", "lia", created.id, true)).rejects.toBeInstanceOf(CommunityVideoAccessError);
  });

  it("accepts one of two simultaneous suggestions of the same video and enforces the per-person limit", async () => {
    const results = await Promise.allSettled([suggest("a", "ana", "aaaaaaaaaaa"), suggest("a", "caio", "aaaaaaaaaaa")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(CommunityVideoConflictError);
    const burst = await Promise.allSettled(["bbbbbbbbbbb", "ccccccccccc", "ddddddddddd", "eeeeeeeeeee"].map((id) => suggest("a", "lia", id)));
    expect(burst.filter((result) => result.status === "fulfilled")).toHaveLength(3);
  });

  it("lets only the owner move videos and keeps rejected ones private", async () => {
    const created = await suggest("a", "ana", "aaaaaaaaaaa");
    await expect(updateCommunityVideoStatus("a", "owner-b", { suggestionId: created.id, status: "rejected" })).rejects.toBeInstanceOf(CommunityVideoAccessError);
    await expect(updateCommunityVideoStatus("b", "owner-b", { suggestionId: created.id, status: "rejected" })).rejects.toBeInstanceOf(CommunityVideoAccessError);
    await expect(updateCommunityVideoStatus("a", "owner-a", { suggestionId: "legacy-1", status: "rejected" })).rejects.toThrow();
    expect(await updateCommunityVideoStatus("a", "owner-a", { suggestionId: created.id, status: "rejected" })).toMatchObject({ status: "rejected" });
    expect(await listCommunityVideos("a")).toEqual({ open: [], reacted: [], rejected: [] });
    expect((await listOwnedCommunityVideos("a", "owner-a")).rejected.map((video) => video.id)).toEqual([created.id]);
    await expect(voteCommunityVideo("a", "lia", created.id, true)).rejects.toBeInstanceOf(CommunityVideoConflictError);
  });

  it("fails closed without the module, for an inactive community and for Ludylops", async () => {
    await pool.query("UPDATE creator_modules SET status='requested' WHERE creator_id='a'");
    await expect(listCommunityVideos("a")).rejects.toBeInstanceOf(CommunityVideoAccessError);
    await expect(suggest("a", "ana", "aaaaaaaaaaa")).rejects.toBeInstanceOf(CommunityVideoAccessError);
    await pool.query("UPDATE creator_modules SET status='installed' WHERE creator_id='a'");
    for (const status of ["disabled", "archived"]) {
      await pool.query("UPDATE creators SET status=$1 WHERE id='a'", [status]);
      await expect(listCommunityVideos("a")).rejects.toBeInstanceOf(CommunityVideoAccessError);
    }
    await expect(listCommunityVideos("creator_ludylops")).rejects.toBeInstanceOf(CommunityVideoAccessError);
    expect((await pool.query("SELECT count(*)::int FROM video_suggestions WHERE creator_id='a'")).rows[0].count).toBe(0);
  });
});
