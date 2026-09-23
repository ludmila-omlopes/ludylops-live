import { and, desc, eq, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { creatorModules, creators, quotes, users } from "@/lib/db/schema";
import { getQuoteDemoStore } from "@/lib/db/repository";
import { isDemoMode } from "@/lib/env";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { listDemoCreatorTenants } from "./demo-store";
import { canUseModules } from "./module-access";
import { ownedQuoteCreateSchema, ownedQuoteUpdateSchema, quoteCursorSchema, type OwnedQuote, type OwnedQuotePage } from "./quote-management";

export class QuoteManagementAccessError extends Error {}
export class QuoteManagementConflictError extends Error {}
type Tx = Parameters<Parameters<NonNullable<ReturnType<typeof getDb>>["transaction"]>[0]>[0];
const limit = 50;
const source = "creator_owner";
function publicQuote(row: { id: string; quoteNumber: number; body: string; createdByDisplayName: string; createdAt: Date | string }): OwnedQuote {
  return { id: row.id, quoteNumber: row.quoteNumber, body: row.body, createdByDisplayName: row.createdByDisplayName,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt };
}
function page(rows: Parameters<typeof publicQuote>[0][]): OwnedQuotePage {
  return { quotes: rows.slice(0, limit).map(publicQuote), nextBefore: rows.length > limit ? rows[limit - 1].quoteNumber : null };
}
function identity(ownerId: string, creatorId: string) {
  if (!ownerId || !creatorId || creatorId === DEFAULT_CREATOR_ID) throw new QuoteManagementAccessError();
}
function authorizeDemo(ownerId: string, creatorId: string) {
  identity(ownerId, creatorId);
  const tenant = listDemoCreatorTenants().find((t) => t.creator.id === creatorId);
  if (tenant?.creator.ownerUserId !== ownerId || !canUseModules(tenant, ["quotes"], "quotes.manage"))
    throw new QuoteManagementAccessError();
}
async function authorize(tx: Tx, ownerId: string, creatorId: string) {
  const [creator] = await tx.select({ id: creators.id, status: creators.status }).from(creators)
    .where(and(eq(creators.id, creatorId), eq(creators.ownerUserId, ownerId))).for("share");
  if (!creator) throw new QuoteManagementAccessError();
  const modules = await tx.select().from(creatorModules).where(eq(creatorModules.creatorId, creatorId)).for("share");
  if (!canUseModules({ creator, modules }, ["quotes"], "quotes.manage")) throw new QuoteManagementAccessError();
}
function database() {
  const db = getDb();
  if (!db) throw new Error("quote_storage_unavailable");
  return db;
}

/** ownerId is always derived from the authenticated session. */
export async function listOwnedQuotes(ownerId: string, creatorId: string, before?: number) {
  identity(ownerId, creatorId);
  if (before !== undefined) quoteCursorSchema.parse(before);
  if (isDemoMode) {
    authorizeDemo(ownerId, creatorId);
    return page([...getQuoteDemoStore({ creatorId }).quotes].filter((q) => before === undefined || q.quoteNumber < before)
      .sort((a, b) => b.quoteNumber - a.quoteNumber));
  }
  return database().transaction(async (tx) => {
    await authorize(tx, ownerId, creatorId);
    return page(await tx.select().from(quotes).where(and(eq(quotes.creatorId, creatorId), before === undefined ? undefined : lt(quotes.quoteNumber, before)))
      .orderBy(desc(quotes.quoteNumber)).limit(limit + 1));
  });
}

export async function createOwnedQuote(ownerId: string, creatorId: string, input: unknown) {
  identity(ownerId, creatorId);
  const parsed = ownedQuoteCreateSchema.parse(input);
  if (isDemoMode) {
    authorizeDemo(ownerId, creatorId);
    const store = getQuoteDemoStore({ creatorId });
    const existing = store.quotes.find((q) => q.id === parsed.id);
    if (existing) {
      if (existing.body !== parsed.body || existing.createdByViewerId !== ownerId || existing.source !== source) throw new QuoteManagementConflictError();
      return publicQuote(existing);
    }
    const viewer = globalThis.__lojaDemoStore?.viewers.find((v) => v.id === ownerId);
    if (!viewer) throw new QuoteManagementAccessError();
    const created = { id: parsed.id, creatorId, quoteNumber: store.quotes.reduce((max, q) => Math.max(max, q.quoteNumber), 0) + 1,
      body: parsed.body, createdByViewerId: viewer.id, createdByDisplayName: viewer.youtubeDisplayName,
      createdByYoutubeHandle: viewer.youtubeHandle ?? null, source, createdAt: new Date().toISOString() };
    store.quotes.push(created);
    return publicQuote(created);
  }
  return database().transaction(async (tx) => {
    await authorize(tx, ownerId, creatorId);
    // Same lock as chat creation: browser/chat share a monotonic per-creator sequence.
    await tx.execute(sql`select pg_advisory_xact_lock(42002, hashtext(${creatorId}))`);
    const [existing] = await tx.select().from(quotes).where(eq(quotes.id, parsed.id));
    if (existing) {
      if (existing.creatorId !== creatorId || existing.body !== parsed.body || existing.createdByViewerId !== ownerId || existing.source !== source)
        throw new QuoteManagementConflictError();
      return publicQuote(existing);
    }
    const [viewer] = await tx.select({ id: users.id, youtubeDisplayName: users.youtubeDisplayName, youtubeHandle: users.youtubeHandle })
      .from(users).where(eq(users.id, ownerId)).for("key share");
    if (!viewer) throw new QuoteManagementAccessError();
    const [latest] = await tx.select({ number: quotes.quoteNumber }).from(quotes).where(eq(quotes.creatorId, creatorId))
      .orderBy(desc(quotes.quoteNumber)).limit(1);
    const [created] = await tx.insert(quotes).values({ id: parsed.id, creatorId, quoteNumber: (latest?.number ?? 0) + 1,
      body: parsed.body, createdByViewerId: viewer.id, createdByDisplayName: viewer.youtubeDisplayName,
      createdByYoutubeHandle: viewer.youtubeHandle, source }).returning();
    return publicQuote(created);
  });
}

export async function updateOwnedQuote(ownerId: string, creatorId: string, input: unknown) {
  identity(ownerId, creatorId);
  const parsed = ownedQuoteUpdateSchema.parse(input);
  if (isDemoMode) {
    authorizeDemo(ownerId, creatorId);
    const quote = getQuoteDemoStore({ creatorId }).quotes.find((q) => q.id === parsed.id);
    if (!quote) throw new QuoteManagementAccessError();
    if (quote.body !== parsed.expectedBody && quote.body !== parsed.body) throw new QuoteManagementConflictError();
    quote.body = parsed.body;
    return publicQuote(quote);
  }
  return database().transaction(async (tx) => {
    await authorize(tx, ownerId, creatorId);
    const [quote] = await tx.select().from(quotes).where(and(eq(quotes.creatorId, creatorId), eq(quotes.id, parsed.id))).for("update");
    if (!quote) throw new QuoteManagementAccessError();
    if (quote.body !== parsed.expectedBody && quote.body !== parsed.body) throw new QuoteManagementConflictError();
    const [updated] = await tx.update(quotes).set({ body: parsed.body })
      .where(and(eq(quotes.creatorId, creatorId), eq(quotes.id, parsed.id))).returning();
    return publicQuote(updated);
  });
}
