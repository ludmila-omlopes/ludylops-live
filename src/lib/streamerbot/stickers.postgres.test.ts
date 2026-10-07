import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false }));
import * as schema from "@/lib/db/schema";
import { receiveSuperSticker, listSuperStickers } from "./stickers";
import { superStickerSchema } from "@/lib/youtube-stickers";
const url = process.env.MODULE_TEST_DATABASE_URL;
const input = (messageId = "m1") => superStickerSchema.parse({ messageId, displayName: "João", amount: "R$ 10,00", stickerImageUrl: "https://yt3.ggpht.com/animated" });
describe.skipIf(!url)("Super Stickers on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `stickers_${randomUUID().replaceAll("-", "")}`;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineConnect = false; neonConfig.pipelineTLS = false;
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, max: 8 });
    await pool.query(`CREATE TABLE creators(id varchar(64) PRIMARY KEY);
      INSERT INTO creators VALUES ('a'), ('b');
      CREATE TABLE streamerbot_event_log(id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL REFERENCES creators(id),
        event_id varchar(128) UNIQUE NOT NULL, event_type varchar(64) NOT NULL, viewer_external_id varchar(128),
        payload jsonb NOT NULL DEFAULT '{}', occurred_at timestamptz NOT NULL, signature_valid boolean DEFAULT true NOT NULL);`);
    state.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => { await pool.query("DELETE FROM streamerbot_event_log"); });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });
  it("deduplicates concurrent retries without conflating different channels", async () => {
    const results = await Promise.all([1, 2, 3].map(() => receiveSuperSticker({ creatorId: "a" }, input())));
    expect(results.filter(result => !result.deduped)).toHaveLength(1);
    expect(await receiveSuperSticker({ creatorId: "b" }, input())).toEqual({ deduped: false });
    const a = await listSuperStickers({ creatorId: "a" }); const b = await listSuperStickers({ creatorId: "b" });
    expect(a.alerts).toHaveLength(1); expect(b.alerts).toHaveLength(1); expect(a.alerts[0].id).not.toBe(b.alerts[0].id);
    expect(Object.keys(a.alerts[0]).sort()).toEqual(["id", "receivedAt", "displayName", "amount", "stickerAltText", "stickerImageUrl"].sort());
    expect((await listSuperStickers({ creatorId: "a" }, a.cursor)).alerts).toEqual([]);
  });
  it("paginates a concurrent burst without losing or replaying alerts", async () => {
    await Promise.all(Array.from({ length: 65 }, (_, n) => receiveSuperSticker({ creatorId: "a" }, input(`m${n}`))));
    const first = await listSuperStickers({ creatorId: "a" });
    const second = await listSuperStickers({ creatorId: "a" }, first.cursor);
    expect(first.alerts).toHaveLength(50); expect(second.alerts).toHaveLength(15);
    const all = [...first.alerts, ...second.alerts]; expect(new Set(all.map(a => a.id)).size).toBe(65);
    expect(new Set(all.map(a => a.receivedAt)).size).toBe(65);
  });
  it("excludes expired, unsigned and other event kinds", async () => {
    await receiveSuperSticker({ creatorId: "a" }, input());
    await pool.query("UPDATE streamerbot_event_log SET occurred_at=now()-interval '2 hours'");
    expect((await listSuperStickers({ creatorId: "a" }, "2020-01-01T00:00:00.000Z|")).alerts).toEqual([]);
    await pool.query("UPDATE streamerbot_event_log SET occurred_at=now(), signature_valid=false");
    expect((await listSuperStickers({ creatorId: "a" })).alerts).toEqual([]);
    await pool.query("UPDATE streamerbot_event_log SET signature_valid=true,event_type='channel_subscription'");
    expect((await listSuperStickers({ creatorId: "a" })).alerts).toEqual([]);
  });
});
