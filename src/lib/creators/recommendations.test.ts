import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ demo: true }));
vi.mock("@/lib/env", () => ({ get isDemoMode() { return state.demo; }, env: {}, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
import { createCreatorArea } from "./service";
import { listProductRecommendations } from "@/lib/db/repository";
import { creatorRecommendationSchema } from "./recommendations";
import { listCreatorRecommendations as list, saveCreatorRecommendation as save, RecommendationAccessError, RecommendationConflictError } from "./recommendations.server";
const item = { name: "Microfone", category: "Áudio", context: "Uso durante as lives.", href: "https://example.com/mic", imageUrl: "", storeLabel: "Loja", linkKind: "affiliate" as const, isActive: false };
let a: string, b: string;
beforeEach(async () => {
  state.demo = true; globalThis.__creatorTenantStore = []; globalThis.__creatorRecommendationsDemo = []; globalThis.__lojaDemoStore = undefined;
  a = (await createCreatorArea("owner", { displayName: "Canal A" })).creator.id;
  b = (await createCreatorArea("other", { displayName: "Canal B" })).creator.id;
});
describe("creator recommendations", () => {
  it("keeps drafts private, publishes and hides without leaking to legacy or another creator", async () => {
    const legacy = await listProductRecommendations();
    const id = randomUUID(); await save(a, "owner", { id, item });
    expect((await list(a, "owner")).items).toEqual([{ id, ...item }]); expect((await list(a)).items).toEqual([]);
    const published = { ...item, isActive: true }; await save(a, "owner", { id, item: published, expected: item }, true);
    expect((await list(a)).items).toEqual([{ id, ...published }]); expect((await list(b)).items).toEqual([]);
    expect(await listProductRecommendations()).toEqual(legacy);
    await save(a, "owner", { id, item, expected: published }, true); expect((await list(a)).items).toEqual([]);
  });
  it("deduplicates retries, rejects stale edits and preserves internal fields", async () => {
    const id = randomUUID(); await Promise.all(Array.from({ length: 4 }, () => save(a, "owner", { id, item })));
    expect((await list(a, "owner")).items).toHaveLength(1);
    await expect(save(a, "owner", { id, item: { ...item, name: "Outro" } })).rejects.toBeInstanceOf(RecommendationConflictError);
    const original = { ...globalThis.__creatorRecommendationsDemo![0] };
    const updated = { ...item, name: "Microfone novo", isActive: true };
    await save(a, "owner", { id, item: updated, expected: item }, true);
    await expect(save(a, "owner", { id, item: { ...item, name: "Antigo" }, expected: item }, true)).rejects.toBeInstanceOf(RecommendationConflictError);
    await save(a, "owner", { id, item: updated, expected: item }, true);
    expect(globalThis.__creatorRecommendationsDemo![0]).toMatchObject({ id, creatorId: a, slug: original.slug, createdAt: original.createdAt, moderationStatus: "approved" });
  });
  it("paginates tied timestamps without repeats and excludes hidden or unapproved rows before limiting", async () => {
    for (let i = 0; i < 54; i++) await save(a, "owner", { id: randomUUID(), item: { ...item, isActive: true } });
    const rows = globalThis.__creatorRecommendationsDemo!; rows.forEach((r) => { r.createdAt = new Date("2026-01-01T00:00:00.000Z"); });
    rows[0].isActive = false; rows[1].moderationStatus = "pending";
    const first = await list(a); expect(first.items).toHaveLength(50); expect(first.nextCursor).toBeTruthy();
    await save(a, "owner", { id: randomUUID(), item: { ...item, isActive: true } });
    const second = await list(a, undefined, first.nextCursor!); expect(second.items).toHaveLength(2); expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((r) => r.id)).size).toBe(52);
    expect((await list(a, "owner")).items).toHaveLength(50);
  });
  it("rejects ownership, scope and cross-creator IDs", async () => {
    const id = randomUUID(); await save(a, "owner", { id, item });
    await expect(list(a, "other")).rejects.toBeInstanceOf(RecommendationAccessError);
    for (const updating of [false, true]) await expect(save(b, "other", { id, item, ...(updating ? { expected: item } : {}) }, updating)).rejects.toBeInstanceOf(RecommendationAccessError);
    await expect(save(a, "owner", { id: randomUUID(), item, expected: item }, true)).rejects.toBeInstanceOf(RecommendationAccessError);
    for (const target of ["", "missing", "creator_ludylops"]) await expect(list(target)).rejects.toBeInstanceOf(RecommendationAccessError);
    await expect(list(a, "")).rejects.toBeInstanceOf(RecommendationAccessError);
  });
  it("depends only on recommendations and blocks disabled modules and creators", async () => {
    const tenant = globalThis.__creatorTenantStore![0];
    tenant.modules.filter((m) => m.moduleKey !== "product_recommendations").forEach((m) => { m.status = "disabled"; });
    await save(a, "owner", { id: randomUUID(), item });
    tenant.modules.find((m) => m.moduleKey === "product_recommendations")!.status = "disabled";
    await expect(list(a)).rejects.toBeInstanceOf(RecommendationAccessError);
    await expect(save(a, "owner", { id: randomUUID(), item })).rejects.toBeInstanceOf(RecommendationAccessError);
    tenant.modules.forEach((m) => { m.status = "installed"; });
    for (const status of ["disabled", "archived"] as const) { tenant.creator.status = status; await expect(list(a)).rejects.toBeInstanceOf(RecommendationAccessError); }
  });
  it("validates URLs and server-controlled fields and fails closed when storage is unavailable", async () => {
    for (const href of ["javascript:alert(1)", "data:text/html,x", "//evil.test", "https://user:password@example.com", "invalid"]) expect(creatorRecommendationSchema.safeParse({ ...item, href }).success).toBe(false);
    for (const imageUrl of ["javascript:alert(1)", "//evil.test", "/\\evil.test"]) expect(creatorRecommendationSchema.safeParse({ ...item, imageUrl }).success).toBe(false);
    expect(creatorRecommendationSchema.safeParse({ ...item, imageUrl: "/example.png" }).success).toBe(true);
    for (const field of ["creatorId", "ownerId", "moderationStatus", "slug", "sortOrder"]) await expect(save(a, "owner", { id: randomUUID(), item: { ...item, [field]: "injected" } })).rejects.toThrow();
    for (const cursor of ["!!!", "e30", "a".repeat(257)]) await expect(list(a, undefined, cursor)).rejects.toThrow("invalid_cursor");
    state.demo = false; await expect(list(a)).rejects.toThrow("recommendation_storage_unavailable");
    await expect(save(a, "owner", { id: randomUUID(), item })).rejects.toThrow("recommendation_storage_unavailable");
  });
});
