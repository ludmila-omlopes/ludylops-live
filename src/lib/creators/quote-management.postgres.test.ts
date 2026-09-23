import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ isDemoMode: false, env: {}, adminEmails: new Set() }));
import * as schema from "@/lib/db/schema";
import { createQuoteRecord, listQuotes } from "@/lib/db/repository";
import { createOwnedQuote, listOwnedQuotes, updateOwnedQuote, QuoteManagementAccessError, QuoteManagementConflictError } from "./quote-management.server";
import type { ViewerRecord } from "@/lib/types";
const url = process.env.MODULE_TEST_DATABASE_URL;
describe.skipIf(!url)("owner quotes on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `quote_owner_${randomUUID().replaceAll("-", "")}`;
  const create = (body = "Pérola", id = randomUUID()) => createOwnedQuote("owner-a", "a", { id, body });
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw new Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineConnect = false; neonConfig.pipelineTLS = false;
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, max: 12 });
    await pool.query(`CREATE TABLE users (id varchar(64) PRIMARY KEY, youtube_display_name varchar(255), youtube_handle varchar(255));
      CREATE TABLE creators (id varchar(64) PRIMARY KEY, owner_user_id varchar(64), status varchar(32));
      CREATE TABLE creator_modules (id varchar(64) PRIMARY KEY, creator_id varchar(64), module_key varchar(64), status varchar(32),
        config_json jsonb DEFAULT '{}', installed_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE quotes (id varchar(64) PRIMARY KEY, creator_id varchar(64) NOT NULL REFERENCES creators(id), quote_number int NOT NULL,
        body text NOT NULL, created_by_viewer_id varchar(64) REFERENCES users(id), created_by_display_name varchar(255),
        created_by_youtube_handle varchar(255), source varchar(64), created_at timestamptz DEFAULT now(), UNIQUE(creator_id,quote_number));
      INSERT INTO users VALUES ('owner-a','Dona A',null),('owner-b','Dona B',null),('viewer','Chat','@chat');
      INSERT INTO creators VALUES ('a','owner-a','active'),('b','owner-b','active');
      INSERT INTO creator_modules (id,creator_id,module_key,status) SELECT c||'-'||m,c,m,'installed'
        FROM unnest(ARRAY['a','b']) c CROSS JOIN unnest(ARRAY['quotes','points','streamerbot','obs_overlays']) m;`);
    state.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => { await pool.query("TRUNCATE quotes; UPDATE creators SET status='active'; UPDATE creator_modules SET status='installed'"); });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });
  it("serializes browser/chat numbering and deduplicates simultaneous retries", async () => {
    const viewer = { id: "viewer", youtubeDisplayName: "Chat", youtubeHandle: "@chat" } as ViewerRecord;
    const id = randomUUID();
    await Promise.all([create("Única", id), create("Única", id), create(), create(),
      createQuoteRecord({ creatorId: "a" }, { body: "Do chat", viewer, source: "streamerbot_chat" })]);
    expect((await listOwnedQuotes("owner-a", "a")).quotes.map((q) => q.quoteNumber)).toEqual([4, 3, 2, 1]);
    expect((await createOwnedQuote("owner-b", "b", { id: randomUUID(), body: "Outra" })).quoteNumber).toBe(1);
  });
  it("preserves registration metadata and protects competing edits", async () => {
    const quote = await create();
    const outcomes = await Promise.allSettled(["Primeira", "Segunda"].map((body) => updateOwnedQuote("owner-a", "a", { id: quote.id, body, expectedBody: quote.body })));
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failure = outcomes.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(QuoteManagementConflictError);
    const saved = (await listQuotes({ creatorId: "a" }))[0];
    expect(saved).toMatchObject({ id: quote.id, quoteNumber: quote.quoteNumber, createdAt: quote.createdAt, createdByDisplayName: quote.createdByDisplayName, source: "creator_owner" });
    expect((await updateOwnedQuote("owner-a", "a", { id: quote.id, body: saved.body, expectedBody: quote.body })).body).toBe(saved.body);
  });
  it("does not permit cross-owner reads/writes or cross-community quote IDs", async () => {
    const quote = await create();
    await expect(listOwnedQuotes("owner-b", "a")).rejects.toBeInstanceOf(QuoteManagementAccessError);
    await expect(createOwnedQuote("owner-b", "a", { id: randomUUID(), body: "Invasão" })).rejects.toBeInstanceOf(QuoteManagementAccessError);
    await expect(updateOwnedQuote("owner-b", "b", { id: quote.id, body: "Invasão", expectedBody: quote.body })).rejects.toBeInstanceOf(QuoteManagementAccessError);
    await expect(createOwnedQuote("owner-b", "b", { id: quote.id, body: quote.body })).rejects.toBeInstanceOf(QuoteManagementConflictError);
    expect((await listQuotes({ creatorId: "a" }))[0].body).toBe(quote.body);
  });
  it("enforces lifecycle and transitive dependencies on each operation", async () => {
    const quote = await create();
    for (const key of ["quotes", "points", "streamerbot", "obs_overlays"]) {
      await pool.query("UPDATE creator_modules SET status='disabled' WHERE id=$1", [`a-${key}`]);
      await expect(listOwnedQuotes("owner-a", "a")).rejects.toBeInstanceOf(QuoteManagementAccessError);
      await expect(create()).rejects.toBeInstanceOf(QuoteManagementAccessError);
      await expect(updateOwnedQuote("owner-a", "a", { id: quote.id, body: "Nova", expectedBody: quote.body })).rejects.toBeInstanceOf(QuoteManagementAccessError);
      await pool.query("UPDATE creator_modules SET status='installed'");
    }
    await pool.query("UPDATE creators SET status='archived' WHERE id='a'");
    await expect(create()).rejects.toBeInstanceOf(QuoteManagementAccessError);
  });
  it("bounds owner reads in SQL and paginates without community leakage", async () => {
    await pool.query(`INSERT INTO quotes (id,creator_id,quote_number,body,created_by_viewer_id,created_by_display_name,source)
      SELECT 'q-'||i,'a',i,'Frase '||i,'owner-a','Dona A','creator_owner' FROM generate_series(1,105) i;`);
    await createOwnedQuote("owner-b", "b", { id: randomUUID(), body: "Somente B" });
    const first = await listOwnedQuotes("owner-a", "a");
    const second = await listOwnedQuotes("owner-a", "a", first.nextBefore!);
    const third = await listOwnedQuotes("owner-a", "a", second.nextBefore!);
    expect([first.quotes.length, second.quotes.length, third.quotes.length]).toEqual([50, 50, 5]);
    expect(third.nextBefore).toBeNull();
    expect(new Set([...first.quotes, ...second.quotes, ...third.quotes].map((q) => q.id)).size).toBe(105);
  });
});
