/** Destructive synthetic fixtures: explicitly named disposable LOCAL databases only. No .env loading. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

async function main() {
  const target = new URL(process.env.QUOTE_ISOLATION_DATABASE_URL ?? "http://invalid");
  assert(["localhost", "127.0.0.1"].includes(target.hostname), "Use a disposable local PostgreSQL database");
  assert(target.pathname.startsWith("/quote_isolation_"), "Database name must start with quote_isolation_");
  const proxy = new URL(`http://${process.env.QUOTE_ISOLATION_WS_PROXY ?? "invalid"}`);
  assert(["localhost", "127.0.0.1"].includes(proxy.hostname), "A local Neon-compatible WebSocket proxy is required");
  process.env.DATABASE_URL = target.href;
  process.env.NEXTAUTH_SECRET = "disposable-quote-verification";
  neonConfig.webSocketConstructor = ws as typeof neonConfig.webSocketConstructor;
  neonConfig.wsProxy = () => proxy.host;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineConnect = false;
  neonConfig.pipelineTLS = false;
  const client = new Client(target.href);
  await client.connect();
  const id = randomUUID().slice(0, 8);
  const viewerId = `quote_test_${id}`;
  const a = { creatorId: `quote_a_${id}` }, b = { creatorId: `quote_b_${id}` };
  const tables = ["quotes", "quote_overlay_state", "obs_overlay_control", "quote_overlay_queue"];
  const snapshot = async (where: string) => Promise.all(tables.map(async table => (await client.query(`select to_jsonb(t) as row from ${table} t ${where} order by to_jsonb(t)::text`)).rows));
  try {
    assert.equal((await client.query("select count(*)::int as n from creators where id='creator_ludylops'")).rows[0].n, 1, "Run the creator baseline first");
    await client.query("insert into users (id,youtube_channel_id,youtube_display_name) values ($1,$1,'Pessoa de teste')", [viewerId]);
    const oldSchema = !(await client.query("select 1 from information_schema.columns where table_name='quotes' and column_name='creator_id'")).rowCount;
    if (oldSchema) {
      await client.query("insert into quotes (id,quote_number,body,created_by_viewer_id,created_by_display_name) values ($1,1,'Frase anterior à migração',$2,'Pessoa de teste')", [`legacy_${id}`, viewerId]);
      await client.query("insert into obs_overlay_control (key,status) values ('quotes','paused')");
      await client.query("insert into quote_overlay_state (slot,overlay_id,quote_number,quote_body,created_by_display_name,requested_by_viewer_id,requested_by_display_name,cost,expires_at) values ('obs_main',$1,1,'Frase antiga','Pessoa de teste',$2,'Pessoa de teste',50,now()-interval '1 hour')", [`old_overlay_${id}`, viewerId]);
      await client.query("insert into quote_overlay_queue (id,quote_number,quote_body,created_by_display_name,requested_by_viewer_id,requested_by_display_name,cost,display_duration_seconds,status,expires_at) values ($1,1,'Fila antiga','Pessoa de teste',$2,'Pessoa de teste',50,10,'completed',now()-interval '1 hour')", [`old_queue_${id}`, viewerId]);
      const before = await snapshot("");
      await client.query("begin");
      await client.query(await readFile(new URL("../drizzle/0025_dazzling_sabretooth.sql", import.meta.url), "utf8"));
      await client.query("commit");
      const after = await snapshot("");
      for (let i = 0; i < before.length; i++) {
        assert.deepEqual(after[i].map(({ row }) => { assert.equal(row.creator_id, "creator_ludylops"); const copy = { ...row }; delete copy.creator_id; return copy; }), before[i].map(({ row }) => row));
      }
      console.log("PASS migration: four tables backfilled without changing existing values");
    }
    for (const context of [a, b]) await client.query("insert into creators (id,slug,display_name) values ($1,$1,$1)", [context.creatorId]);
    const repo = await import("../src/lib/db/repository");
    const { defaultCreatorContext: d } = await import("../src/lib/creators/context");
    const create = (context: typeof a, text: string) => repo.runQuoteCommandFromChat(context, { action: "create", viewerExternalId: viewerId, quoteText: text, source: "isolation_test" });
    const balancesBefore = (await client.query("select * from viewer_balances order by viewer_id")).rows;
    const firstA = await create(a, "Frase A"), firstB = await create(b, "Frase B");
    assert.equal(firstA.quote.quoteNumber, 1); assert.equal(firstB.quote.quoteNumber, 1);
    await Promise.all(Array.from({ length: 8 }, (_, i) => create(a, `Concorrente ${i}`)));
    assert.deepEqual((await repo.listQuotes(a)).map(q => q.quoteNumber), [9,8,7,6,5,4,3,2,1]);
    assert.deepEqual((await repo.listQuotes(b)).map(q => q.body), ["Frase B"]);
    for (const quoteId of [1, undefined]) assert.equal((await repo.runQuoteCommandFromChat(b, { action: "get", quoteId, source: "test" })).quote.body, "Frase B");
    await assert.rejects(repo.runQuoteCommandFromChat(b, { action: "get", quoteId: 2, source: "test" }), /quote_not_found/);
    assert.deepEqual((await client.query("select * from viewer_balances order by viewer_id")).rows, balancesBefore);
    await repo.ingestStreamerbotEvent({ eventId: `compat_${id}`, eventType: "manual_adjustment", viewerExternalId: viewerId, amount: 10, occurredAt: new Date().toISOString(), payload: {} });
    assert.equal((await client.query("select current_balance from viewer_balances where viewer_id=$1", [firstA.viewer!.id])).rows[0].current_balance, 10);
    for (const context of [a, b]) {
      await client.query("insert into obs_overlay_control (creator_id,key,status) values ($1,'quotes','paused')", [context.creatorId]);
      await client.query("insert into quote_overlay_state (creator_id,slot,overlay_id,quote_number,quote_body,created_by_display_name,requested_by_viewer_id,requested_by_display_name,cost,expires_at) values ($1,'obs_main',$1,1,$3,'Teste',$2,'Teste',50,now()+interval '1 hour')", [context.creatorId, viewerId, context.creatorId]);
      await client.query("insert into quote_overlay_queue (creator_id,id,quote_number,quote_body,created_by_display_name,requested_by_viewer_id,requested_by_display_name,cost,display_duration_seconds,expires_at) values ($1,$1,1,$3,'Teste',$2,'Teste',50,10,now()-interval '1 hour')", [context.creatorId, viewerId, context.creatorId]);
      assert.equal((await repo.getActiveQuoteOverlay(context))?.creatorId, context.creatorId);
      assert.equal((await repo.getObsOverlayControlRecord(context)).creatorId, context.creatorId);
    }
    const foreignBefore = await snapshot("where creator_id <> 'creator_ludylops'");
    for (const context of [a,b]) {
      await assert.rejects(repo.showQuoteOverlayForViewer(context, { quoteId: 1, viewerId, source: "test" }), /operation_not_isolated/);
      await assert.rejects(repo.processNextQueuedQuoteOverlay(context), /operation_not_isolated/);
      await assert.rejects(repo.cancelQueuedQuoteOverlays(context, {}), /operation_not_isolated/);
      await assert.rejects(repo.setObsOverlayPaused(context, { paused: false }), /operation_not_isolated/);
    }
    // Default creator keeps its paid path, including one claim and one refund under concurrency.
    const defaultQuote = await create(d, "Compatibilidade da live");
    const defaultViewer = defaultQuote.viewer!;
    await client.query("insert into viewer_balances (viewer_id,current_balance,lifetime_earned,lifetime_spent) values ($1,1000,1000,0) on conflict (viewer_id) do update set current_balance=1000,lifetime_earned=1000,lifetime_spent=0", [defaultViewer.id]);
    await client.query("insert into streamerbot_counters (key,value,metadata) values ('livestream_override',1,$1) on conflict (key) do update set metadata=excluded.metadata", [JSON.stringify({ mode: "manual", isLive: true, updatedAt: new Date().toISOString() })]);
    await client.query("delete from quote_overlay_state where creator_id='creator_ludylops'");
    await repo.setObsOverlayPaused(d, { paused: true });
    const queued = await repo.showQuoteOverlayForViewer(d, { viewerId: defaultViewer.id, quoteId: defaultQuote.quote.quoteNumber, source: "test" });
    assert(queued.queued);
    const cost = queued.queued.cost;
    assert.equal((await client.query("select current_balance from viewer_balances where viewer_id=$1", [defaultViewer.id])).rows[0].current_balance, 1000-cost);
    await client.query("update obs_overlay_control set status='active' where creator_id='creator_ludylops' and key='quotes'");
    await Promise.all([repo.processNextQueuedQuoteOverlay(d), repo.processNextQueuedQuoteOverlay(d)]);
    assert.equal((await client.query("select status from quote_overlay_queue where id=$1", [queued.queued.id])).rows[0].status, "completed");
    assert.equal((await client.query("select count(*)::int as n from point_ledger where viewer_id=$1 and kind='quote_overlay_debit'", [defaultViewer.id])).rows[0].n, 1);
    await repo.setObsOverlayPaused(d, { paused: true });
    const cancelled = await repo.showQuoteOverlayForViewer(d, { viewerId: defaultViewer.id, quoteId: defaultQuote.quote.quoteNumber, source: "test" });
    assert(cancelled.queued);
    await Promise.all([repo.cancelQueuedQuoteOverlays(d, {}), repo.cancelQueuedQuoteOverlays(d, {})]);
    assert.equal((await client.query("select current_balance from viewer_balances where viewer_id=$1", [defaultViewer.id])).rows[0].current_balance, 1000-cost);
    assert.equal((await client.query("select count(*)::int as n from point_ledger where viewer_id=$1 and kind='quote_overlay_debit' and amount>0", [defaultViewer.id])).rows[0].n, 1);
    assert.deepEqual(await snapshot("where creator_id <> 'creator_ludylops'"), foreignBefore);
    await assert.rejects(client.query("update quotes set creator_id=null where creator_id=$1", [b.creatorId]), /null value/);
    await assert.rejects(client.query("update quotes set creator_id='missing_creator' where creator_id=$1", [b.creatorId]), /foreign key/);
    await assert.rejects(client.query("update quotes set quote_number=1 where creator_id=$1", [a.creatorId]), /duplicate key/);
    await client.query("alter table quotes rename column body to unavailable_body");
    try {
      await assert.rejects(repo.listQuotes(a));
    } finally {
      await client.query("alter table quotes rename column unavailable_body to body");
    }
    assert.equal(globalThis.__lojaDemoStore, undefined);
    console.log("PASS PostgreSQL: independent numbering/reads, concurrent inserts, scoped state/control, fail-closed paid paths, single queue claim/debit/refund, foreign queues preserved, FK/NOT NULL/unique constraints");
  } finally {
    await client.query("rollback");
    await client.end();
    await globalThis.__lojaDb?.$client.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
