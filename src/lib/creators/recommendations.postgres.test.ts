import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, env: {}, adminEmails: new Set() }));
import * as schema from "@/lib/db/schema";
import { listProductRecommendations, listAdminProductRecommendations, upsertProductRecommendation, updateProductRecommendationStatus, deleteProductRecommendation } from "@/lib/db/repository";
import { listCreatorRecommendations as list, saveCreatorRecommendation as save, RecommendationAccessError, RecommendationConflictError } from "./recommendations.server";
const url = process.env.MODULE_TEST_DATABASE_URL;
const item = { name: "Microfone", category: "Áudio", context: "Uso durante as lives.", href: "https://example.com/mic", imageUrl: "", storeLabel: "Loja", linkKind: "affiliate" as const, isActive: true };
describe.skipIf(!url)("recommendations on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `recommendations_${randomUUID().replaceAll("-", "")}`;
  const create = (id = randomUUID(), isActive = true) => save("a", "owner-a", { id, item: { ...item, isActive } });
  const legacy = (id: string = randomUUID()) => ({ ...item, category: "setup" as const, id, slug: `legacy-${id}`, moderationStatus: "approved" as const, sortOrder: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw new Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineConnect = false; neonConfig.pipelineTLS = false;
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, max: 8 });
    await pool.query(`CREATE TABLE creators (id varchar(64) PRIMARY KEY, status text, owner_user_id text);
      CREATE TABLE creator_modules (id varchar(64) PRIMARY KEY, creator_id varchar(64) REFERENCES creators(id), module_key text, status text,
        config_json jsonb DEFAULT '{}', installed_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(creator_id,module_key));
      CREATE TABLE product_recommendations (id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL DEFAULT 'creator_ludylops' REFERENCES creators(id),
        slug varchar(160) NOT NULL UNIQUE, name varchar(255) NOT NULL, category varchar(32) NOT NULL, context text NOT NULL, image_url text NOT NULL,
        href text NOT NULL, store_label varchar(120) NOT NULL, link_kind varchar(32) NOT NULL, moderation_status varchar(32) NOT NULL DEFAULT 'approved',
        is_active boolean NOT NULL DEFAULT true, sort_order int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
      INSERT INTO creators VALUES ('a','active','owner-a'),('b','active','owner-b'),('creator_ludylops','active','legacy-owner');
      INSERT INTO creator_modules (id,creator_id,module_key,status) VALUES ('a-rec','a','product_recommendations','installed'),('b-rec','b','product_recommendations','installed');`);
    state.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => { await pool.query("TRUNCATE product_recommendations; UPDATE creators SET status='active'; UPDATE creator_modules SET status='installed'"); });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });
  it("isolates public and owner reads, legacy readers, drafts and moderation", async () => {
    const old = legacy(); await upsertProductRecommendation(old);
    const published = await create(), hidden = await create(randomUUID(), false);
    const pending = await create(); await pool.query("UPDATE product_recommendations SET moderation_status='pending' WHERE id=$1", [pending.id]);
    await save("b", "owner-b", { id: randomUUID(), item });
    expect((await list("a")).items).toEqual([published]);
    expect((await list("a", "owner-a")).items).toHaveLength(3);
    expect((await list("b")).items).toHaveLength(1);
    expect((await listProductRecommendations()).map((r) => r.id)).toEqual([old.id]);
    expect((await listAdminProductRecommendations()).map((r) => r.id)).toEqual([old.id]);
    expect((await list("a", "owner-a")).items.find((r) => r.id === hidden.id)?.isActive).toBe(false);
  });
  it("prevents legacy writes from overwriting, moderating or deleting creator products", async () => {
    const own = await create();
    await expect(upsertProductRecommendation(legacy(own.id))).rejects.toThrow("recommendation_not_found");
    await expect(updateProductRecommendationStatus({ recommendationId: own.id, isActive: false })).rejects.toThrow("recommendation_not_found");
    await expect(deleteProductRecommendation(own.id)).rejects.toThrow("recommendation_not_found");
    expect((await list("a")).items).toEqual([own]);
    const old = legacy(); await upsertProductRecommendation(old);
    expect((await pool.query("SELECT creator_id FROM product_recommendations WHERE id=$1", [old.id])).rows[0].creator_id).toBe("creator_ludylops");
    await updateProductRecommendationStatus({ recommendationId: old.id, isActive: false });
    expect(await listProductRecommendations()).toEqual([]); await deleteProductRecommendation(old.id);
    expect(await listAdminProductRecommendations()).toEqual([]);
  });
  it("serializes duplicate creation and competing edits without losing updates", async () => {
    const id = randomUUID(); await Promise.all(Array.from({ length: 5 }, () => create(id)));
    expect((await list("a", "owner-a")).items).toHaveLength(1);
    const results = await Promise.allSettled(["Primeiro", "Segundo"].map((name) => save("a", "owner-a", { id, item: { ...item, name }, expected: item }, true)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(RecommendationConflictError);
    const current = (await list("a")).items[0]; const { id: _, ...saved } = current; void _;
    expect(await save("a", "owner-a", { id, item: saved, expected: item }, true)).toEqual(current);
  });
  it("checks ownership, lifecycle and modules for every read and write", async () => {
    const own = await create();
    await expect(list("a", "owner-b")).rejects.toBeInstanceOf(RecommendationAccessError);
    await expect(save("b", "owner-b", { id: own.id, item })).rejects.toBeInstanceOf(RecommendationAccessError);
    await expect(save("b", "owner-b", { id: own.id, item, expected: item }, true)).rejects.toBeInstanceOf(RecommendationAccessError);
    await pool.query("UPDATE creator_modules SET status='disabled' WHERE creator_id='a'");
    await expect(list("a")).rejects.toBeInstanceOf(RecommendationAccessError); await expect(create()).rejects.toBeInstanceOf(RecommendationAccessError);
    await pool.query("UPDATE creator_modules SET status='installed'");
    for (const status of ["disabled", "archived"]) {
      await pool.query("UPDATE creators SET status=$1 WHERE id='a'", [status]);
      await expect(list("a")).rejects.toBeInstanceOf(RecommendationAccessError); await expect(create()).rejects.toBeInstanceOf(RecommendationAccessError);
    }
    expect((await pool.query("SELECT count(*)::int AS count FROM product_recommendations")).rows[0].count).toBe(1);
  });
  it("paginates ties before the limit, preserving a stable cursor when newer products arrive", async () => {
    await Promise.all(Array.from({ length: 54 }, () => create()));
    await pool.query("UPDATE product_recommendations SET created_at='2026-01-01T00:00:00Z'");
    await pool.query("UPDATE product_recommendations SET is_active=false WHERE id IN (SELECT id FROM product_recommendations ORDER BY id DESC LIMIT 2)");
    const first = await list("a"); expect(first.items).toHaveLength(50); expect(first.nextCursor).toBeTruthy();
    await create(); const second = await list("a", undefined, first.nextCursor!);
    expect(second.items).toHaveLength(2); expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((r) => r.id)).size).toBe(52);
  });
  it("preserves moderation and creation metadata while publishing, editing and hiding", async () => {
    const own = await create(randomUUID(), false);
    const original = (await pool.query("SELECT * FROM product_recommendations WHERE id=$1", [own.id])).rows[0];
    await pool.query("UPDATE product_recommendations SET moderation_status='pending' WHERE id=$1", [own.id]);
    await save("a", "owner-a", { id: own.id, item, expected: { ...item, isActive: false } }, true);
    expect((await list("a")).items).toEqual([]);
    const row = (await pool.query("SELECT * FROM product_recommendations WHERE id=$1", [own.id])).rows[0];
    expect(row).toMatchObject({ creator_id: "a", slug: original.slug, created_at: original.created_at, moderation_status: "pending", is_active: true });
  });
});
