import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: mocks.db }));
vi.mock("@/lib/env", () => ({ adminEmails: new Set(["admin@example.com"]) }));
import * as schema from "@/lib/db/schema";
import { canCreateCreatorArea, getCreatorAreaAccessSettings, getCreatorBetaRequest, listPendingCreatorBetaRequests, reviewCreatorBetaRequest, submitCreatorBetaRequest, updateCreatorAreaAccessSettings } from "./access";

const url = process.env.MODULE_TEST_DATABASE_URL;
describe.skipIf(!url)("beta requests on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `beta_${randomUUID().replaceAll("-", "")}`;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineConnect = false; neonConfig.pipelineTLS = false;
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, application_name: namespace, max: 8 });
    await pool.query("CREATE TABLE streamerbot_counters(key varchar(64) PRIMARY KEY,value integer NOT NULL DEFAULT 0,last_reset_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),metadata jsonb NOT NULL DEFAULT '{}')");
    mocks.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => { await pool.query("TRUNCATE streamerbot_counters"); });
  afterAll(async () => {
    if (pool) await pool.end();
    if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); }
  });

  it("serializes simultaneous submissions and approvals while preserving the existing allowlist metadata", async () => {
    const initial = await updateCreatorAreaAccessSettings({ allowedEmails: ["existing@example.com"], updatedBy: "admin@example.com" });
    await pool.query("UPDATE streamerbot_counters SET metadata=metadata || '{\"preserved\":true}'::jsonb");
    const submitted = await Promise.all(Array.from({ length: 8 }, () => submitCreatorBetaRequest("a@example.com")));
    expect(new Set(submitted.map(result => result.request!.requestedAt)).size).toBe(1);
    const b = await submitCreatorBetaRequest("b@example.com");
    await Promise.all([
      reviewCreatorBetaRequest(submitted[0].request!.id, "approved", "admin@example.com"),
      reviewCreatorBetaRequest(b.request!.id, "approved", "admin@example.com"),
    ]);
    expect((await getCreatorAreaAccessSettings()).allowedEmails).toEqual(["a@example.com", "b@example.com", "existing@example.com"]);
    expect((await listPendingCreatorBetaRequests()).requests).toHaveLength(0);
    expect((await getCreatorBetaRequest("b@example.com"))?.reviewedBy).toBe("admin@example.com");
    expect(await canCreateCreatorArea("a@example.com")).toBe(true);
    await expect(updateCreatorAreaAccessSettings({ allowedEmails: initial.allowedEmails, updatedBy: "admin@example.com", expectedUpdatedAt: initial.updatedAt })).rejects.toThrow("A lista foi alterada");
    const { rows } = await pool.query("SELECT metadata FROM streamerbot_counters WHERE key='creator_area_beta_access'");
    expect(rows[0].metadata.preserved).toBe(true);
  });

  it("rolls back an approval at the allowlist limit and preserves a pending request", async () => {
    await updateCreatorAreaAccessSettings({ allowedEmails: Array.from({ length: 200 }, (_, index) => `existing${index}@example.com`), updatedBy: "admin@example.com" });
    const submitted = await submitCreatorBetaRequest("new@example.com");
    await expect(reviewCreatorBetaRequest(submitted.request!.id, "approved", "admin@example.com")).rejects.toThrow();
    expect((await getCreatorBetaRequest("new@example.com"))?.status).toBe("pending");
    expect(await canCreateCreatorArea("new@example.com")).toBe(false);
    await reviewCreatorBetaRequest(submitted.request!.id, "rejected", "admin@example.com");
    expect((await listPendingCreatorBetaRequests()).requests).toHaveLength(0);
    expect((await submitCreatorBetaRequest("new@example.com")).request?.status).toBe("pending");
  });
});
