import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ demo: true }));
vi.mock("@/lib/env", () => ({ get isDemoMode() { return state.demo; }, env: {}, adminEmails: new Set() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => null }));
import { createCreatorArea } from "./service";
import { createQuoteRecord, ensureViewerFromStreamerbotIdentity, getQuoteDemoStore, listQuotes } from "@/lib/db/repository";
import { createOwnedQuote, listOwnedQuotes, updateOwnedQuote, QuoteManagementAccessError, QuoteManagementConflictError } from "./quote-management.server";

let a: string, b: string, owner: string;
beforeEach(async () => {
  state.demo = true; globalThis.__creatorTenantStore = []; globalThis.__lojaDemoStore = undefined;
  const viewer = await ensureViewerFromStreamerbotIdentity({ viewerExternalId: "UCabcdefghijklmnopqrstuv", youtubeDisplayName: "Dona A", initializeBalance: false });
  owner = viewer.id;
  a = (await createCreatorArea(owner, { displayName: "Canal A" })).creator.id;
  b = (await createCreatorArea("other", { displayName: "Canal B" })).creator.id;
  getQuoteDemoStore({ creatorId: a }).quotes = []; getQuoteDemoStore({ creatorId: b }).quotes = [];
});
const create = (body = "Pérola da live", id = randomUUID()) => createOwnedQuote(owner, a, { id, body });
describe("owner quote management", () => {
  it("uses server authorship, shares the public store and preserves independent numbering", async () => {
    const first = await create();
    expect(first).toMatchObject({ quoteNumber: 1, createdByDisplayName: "Dona A" });
    expect(Object.keys(first).sort()).toEqual(["body", "createdAt", "createdByDisplayName", "id", "quoteNumber"]);
    const viewer = globalThis.__lojaDemoStore!.viewers.find((v) => v.id === owner)!;
    const chat = await createQuoteRecord({ creatorId: a }, { viewer, body: "Do chat", source: "streamerbot_chat" });
    expect(chat.quoteNumber).toBe(2);
    expect((await create()).quoteNumber).toBe(3);
    expect(await listQuotes({ creatorId: b })).toEqual([]);
    expect((await listQuotes({ creatorId: a }))[2].body).toBe(first.body);
  });
  it("retries creation without duplicating and rejects reused IDs with changed text", async () => {
    const id = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => create("Uma vez", id)));
    expect(new Set(results.map((r) => r.quoteNumber)).size).toBe(1);
    expect((await listOwnedQuotes(owner, a)).quotes).toHaveLength(1);
    await expect(create("Outra", id)).rejects.toBeInstanceOf(QuoteManagementConflictError);
  });
  it("corrects chat text without changing original author, number or registration time", async () => {
    const viewer = await ensureViewerFromStreamerbotIdentity({ viewerExternalId: "UC1234567890123456789012", youtubeDisplayName: "Espectadora", initializeBalance: false });
    const quote = await createQuoteRecord({ creatorId: a }, { viewer, body: "Erro", source: "streamerbot_chat" });
    const original = { ...quote };
    const corrected = await updateOwnedQuote(owner, a, { id: quote.id, body: "Correção", expectedBody: "Erro" });
    expect(corrected).toMatchObject({ quoteNumber: 1, body: "Correção", createdByDisplayName: "Espectadora", createdAt: original.createdAt });
    expect((await listQuotes({ creatorId: a }))[0]).toEqual({ ...original, body: "Correção" });
    await expect(updateOwnedQuote(owner, a, { id: quote.id, body: "Antiga", expectedBody: "Erro" })).rejects.toBeInstanceOf(QuoteManagementConflictError);
    expect(await updateOwnedQuote(owner, a, { id: quote.id, body: "Correção", expectedBody: "Erro" })).toEqual(corrected);
  });
  it("bounds pagination and does not repeat quotes when newer ones arrive", async () => {
    for (let i = 0; i < 52; i++) await create(`Frase ${i}`);
    const first = await listOwnedQuotes(owner, a);
    expect(first.quotes).toHaveLength(50); expect(first.nextBefore).toBe(3);
    await create("Nova");
    expect((await listOwnedQuotes(owner, a, first.nextBefore!)).quotes.map((q) => q.quoteNumber)).toEqual([2, 1]);
  });
  it("denies another owner, creator, missing scope and legacy creator", async () => {
    const quote = await create();
    await expect(listOwnedQuotes("other", a)).rejects.toBeInstanceOf(QuoteManagementAccessError);
    await expect(createOwnedQuote(owner, b, { id: randomUUID(), body: "Invasão" })).rejects.toBeInstanceOf(QuoteManagementAccessError);
    await expect(updateOwnedQuote("other", b, { id: quote.id, body: "Invasão", expectedBody: quote.body })).rejects.toBeInstanceOf(QuoteManagementAccessError);
    for (const id of ["", "missing", "creator_ludylops"]) await expect(listOwnedQuotes(owner, id)).rejects.toBeInstanceOf(QuoteManagementAccessError);
    expect((await listQuotes({ creatorId: a }))[0].body).toBe(quote.body);
  });
  it.each(["quotes", "points", "streamerbot", "obs_overlays"])("blocks disabled %s for reads and writes", async (key) => {
    globalThis.__creatorTenantStore![0].modules.find((m) => m.moduleKey === key)!.status = "disabled";
    await expect(listOwnedQuotes(owner, a)).rejects.toBeInstanceOf(QuoteManagementAccessError);
    await expect(create()).rejects.toBeInstanceOf(QuoteManagementAccessError);
  });
  it.each(["disabled", "archived"] as const)("blocks %s creators", async (status) => {
    globalThis.__creatorTenantStore![0].creator.status = status;
    await expect(create()).rejects.toBeInstanceOf(QuoteManagementAccessError);
  });
  it("validates text, authorship injection and cursor, and fails closed in production", async () => {
    for (const body of ["   ", "a".repeat(501)]) await expect(create(body)).rejects.toThrow();
    await expect(createOwnedQuote(owner, a, { id: randomUUID(), body: "Frase", createdByViewerId: "other" })).rejects.toThrow();
    for (const before of [0, -1, Infinity, 1.5, 2147483648]) await expect(listOwnedQuotes(owner, a, before)).rejects.toThrow();
    state.demo = false;
    await expect(listOwnedQuotes(owner, a)).rejects.toThrow("quote_storage_unavailable");
    await expect(create()).rejects.toThrow("quote_storage_unavailable");
  });
});
