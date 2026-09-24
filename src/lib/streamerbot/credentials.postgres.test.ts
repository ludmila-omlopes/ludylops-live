import { randomUUID } from "node:crypto";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: vi.fn(), env: { STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY: "" } }));
vi.mock("@/lib/db/client", () => ({ getDb: state.db }));
vi.mock("@/lib/env", () => ({ env: state.env }));
import * as schema from "@/lib/db/schema";
import { credentialIsUsable, findStreamerbotCredential, issueStreamerbotCredential, listOwnedStreamerbotCredentials, revokeStreamerbotCredential } from "./credentials";
import { decryptCredentialSecret } from "./credential-crypto";
const url = process.env.MODULE_TEST_DATABASE_URL;
const owner = { kind: "owner" as const, viewerId: "owner-a" };
describe.skipIf(!url)("owner credentials on PostgreSQL", () => {
  let admin: Pool, pool: Pool;
  const namespace = `credentials_${randomUUID().replaceAll("-", "")}`;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/modules_185_test") throw Error("Dedicated local modules_185_test required");
    neonConfig.webSocketConstructor = ws as NonNullable<typeof neonConfig.webSocketConstructor>;
    neonConfig.wsProxy = () => `127.0.0.1:${process.env.MODULE_TEST_WS_PORT ?? "55479"}`;
    neonConfig.useSecureWebSocket = false; neonConfig.pipelineConnect = false; neonConfig.pipelineTLS = false;
    admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${namespace}`, application_name: namespace, max: 8 });
    await pool.query(`CREATE TABLE creators(id varchar(64) PRIMARY KEY, slug text, display_name text, owner_user_id text, status text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE creator_modules(id varchar(64) PRIMARY KEY,creator_id varchar(64) REFERENCES creators(id),module_key text,status text,config_json jsonb DEFAULT '{}',installed_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
      CREATE TABLE streamerbot_credentials(id varchar(64) PRIMARY KEY, creator_id varchar(64) REFERENCES creators(id) NOT NULL, encrypted_secret text NOT NULL, status text DEFAULT 'active',created_at timestamptz DEFAULT now(),retiring_until timestamptz,revoked_at timestamptz,last_used_at timestamptz);
      INSERT INTO creators(id,slug,display_name,owner_user_id,status) VALUES ('a','a','A','owner-a','active'),('b','b','B','owner-b','active'),('creator_ludylops','ludylops','Ludylops','owner-a','active');
      INSERT INTO creator_modules(id,creator_id,module_key,status) VALUES ('m-a','a','streamerbot','installed'),('m-b','b','streamerbot','installed'),('m-l','creator_ludylops','streamerbot','installed');`);
    state.db.mockReturnValue(drizzle({ client: pool, schema }));
  });
  beforeEach(async () => {
    state.env.STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    await pool.query("DELETE FROM streamerbot_credentials; UPDATE creators SET status='active'; UPDATE creators SET owner_user_id='owner-a' WHERE id='a'; UPDATE creator_modules SET status='installed'");
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); } });
  it("encrypts secrets, lists only metadata and isolates two owners and credential IDs", async () => {
    const a = await issueStreamerbotCredential("a", undefined, owner);
    const b = await issueStreamerbotCredential("b", undefined, { kind: "owner", viewerId: "owner-b" });
    const row = (await findStreamerbotCredential(a.id))!;
    expect(row.encryptedSecret).not.toContain(a.secret);
    expect(decryptCredentialSecret(row.encryptedSecret, a.id, "a", state.env.STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY)).toBe(a.secret);
    const listed = await listOwnedStreamerbotCredentials("a", "owner-a");
    expect(listed.canIssue).toBe(true); expect(listed.credentials.map(c => c.id)).toEqual([a.id]);
    expect(Object.keys(listed.credentials[0]).sort()).toEqual(["createdAt", "id", "lastUsedAt", "retiringUntil", "revokedAt", "status"]);
    await expect(listOwnedStreamerbotCredentials("a", "owner-b")).rejects.toMatchObject({ status: 404 });
    await expect(issueStreamerbotCredential("b", undefined, owner)).rejects.toMatchObject({ status: 404 });
    await expect(revokeStreamerbotCredential("b", b.id, owner)).rejects.toMatchObject({ status: 404 });
    await expect(revokeStreamerbotCredential("a", b.id, owner)).rejects.toMatchObject({ status: 404 });
    await expect(issueStreamerbotCredential("a", b.id, owner)).rejects.toMatchObject({ status: 409 });
    expect(credentialIsUsable((await findStreamerbotCredential(b.id))!)).toBe(true);
  });
  it("denies legacy self-service while retaining platform recovery", async () => {
    await expect(listOwnedStreamerbotCredentials("creator_ludylops", "owner-a")).rejects.toMatchObject({ status: 404 });
    await expect(issueStreamerbotCredential("creator_ludylops", undefined, owner)).rejects.toMatchObject({ status: 404 });
    const legacy = await issueStreamerbotCredential("creator_ludylops");
    await expect(revokeStreamerbotCredential("creator_ludylops", legacy.id, owner)).rejects.toMatchObject({ status: 404 });
    expect((await revokeStreamerbotCredential("creator_ludylops", legacy.id)).status).toBe("revoked");
  });
  it("serializes first issuance and rotation, preserves the 24-hour transition", async () => {
    const attempts = await Promise.allSettled([1, 2, 3].map(() => issueStreamerbotCredential("a", undefined, owner)));
    expect(attempts.filter(a => a.status === "fulfilled")).toHaveLength(1);
    const original = (await listOwnedStreamerbotCredentials("a", "owner-a")).credentials[0];
    const rotations = await Promise.allSettled([1, 2].map(() => issueStreamerbotCredential("a", original.id, owner)));
    expect(rotations.filter(a => a.status === "fulfilled")).toHaveLength(1);
    const retired = (await findStreamerbotCredential(original.id))!;
    expect(retired.status).toBe("retiring"); expect(credentialIsUsable(retired)).toBe(true);
    expect(retired.retiringUntil!.getTime() - Date.now()).toBeGreaterThan(23.99 * 60 * 60 * 1000);
    expect(credentialIsUsable(retired, retired.retiringUntil!.getTime())).toBe(false);
    expect((await listOwnedStreamerbotCredentials("a", "owner-a")).credentials.filter(c => c.status === "active")).toHaveLength(1);
  });
  it("never resurrects a credential during concurrent rotation and revocation", async () => {
    const first = await issueStreamerbotCredential("a", undefined, owner);
    await Promise.allSettled([issueStreamerbotCredential("a", first.id, owner), revokeStreamerbotCredential("a", first.id, owner)]);
    expect((await findStreamerbotCredential(first.id))!.status).toBe("revoked");
    expect(credentialIsUsable((await findStreamerbotCredential(first.id))!)).toBe(false);
  });
  it("allows recovery for disabled/archived owners but denies issuance and rotation", async () => {
    for (const status of ["disabled", "archived", "module-disabled"]) {
      await pool.query("UPDATE creators SET status='active'; UPDATE creator_modules SET status='installed'");
      const issued = await issueStreamerbotCredential("a", undefined, owner);
      if (status === "module-disabled") await pool.query("UPDATE creator_modules SET status='disabled' WHERE id='m-a'");
      else await pool.query("UPDATE creators SET status=$1 WHERE id='a'", [status]);
      expect((await listOwnedStreamerbotCredentials("a", "owner-a")).canIssue).toBe(false);
      await expect(issueStreamerbotCredential("a", issued.id, owner)).rejects.toMatchObject({ status: 409 });
      await revokeStreamerbotCredential("a", issued.id, owner);
      await expect(issueStreamerbotCredential("a", undefined, owner)).rejects.toMatchObject({ status: 409 });
    }
  });
  it("leaves the current credential untouched when encryption configuration is unavailable", async () => {
    const issued = await issueStreamerbotCredential("a", undefined, owner);
    state.env.STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY = "";
    await expect(issueStreamerbotCredential("a", issued.id, owner)).rejects.toThrow();
    expect((await findStreamerbotCredential(issued.id))!.status).toBe("active");
    expect((await listOwnedStreamerbotCredentials("a", "owner-a")).credentials).toHaveLength(1);
    await revokeStreamerbotCredential("a", issued.id, owner);
  });
  it("rechecks ownership after waiting for a concurrent transfer", async () => {
    const client = await pool.connect();
    await client.query("BEGIN"); await client.query("UPDATE creators SET owner_user_id='owner-b' WHERE id='a'");
    const attempt = issueStreamerbotCredential("a", undefined, owner).then(() => null, error => error);
    try {
      await vi.waitFor(async () => {
        const blocked = await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [namespace]);
        expect(blocked.rows[0].count).toBeGreaterThan(0);
      });
      await client.query("COMMIT");
      expect(await attempt).toMatchObject({ status: 404 });
      expect((await listOwnedStreamerbotCredentials("a", "owner-b")).credentials).toEqual([]);
    } finally { await client.query("ROLLBACK"); client.release(); }
  });
});
