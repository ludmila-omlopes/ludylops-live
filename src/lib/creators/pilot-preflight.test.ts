import { describe, expect, it, vi } from "vitest";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../db/schema";
import type { BaselineConnection } from "../db/creator-baseline";
import { encryptCredentialSecret } from "../streamerbot/credential-crypto";
import { runPilotPreflight } from "./pilot-preflight";
import { runPilotCli } from "../../../scripts/creator-pilot";

const key = Buffer.alloc(32, 9).toString("base64");
const secret = "private-credential-secret";
const settings = { economyEnabled: "true", encryptionKey: key };
const slugs = ["teste-1", "teste-2"];
type Row = Record<string, unknown>;
class Database implements BaselineConnection {
  calls: { text: string; values: unknown[] }[] = [];
  missingColumn = false;
  failQuery = false;
  sameOwner = false;
  missingOwner = false;
  missingCreator = false;
  legacyCreator = false;
  disabled = false;
  disabledModule = "";
  chatEnabled = true;
  credentialCount = 1;
  credentialKey = key;
  catalogAvailable = true;
  heartbeat = true;
  connect = vi.fn(async () => undefined);
  end = vi.fn(async () => undefined);
  async query<T extends Row = Row>(text: string, values: unknown[] = []): Promise<{ rows: T[] }> {
    this.calls.push({ text, values });
    let rows: Row[] = [];
    if (text.startsWith("BEGIN") || text.startsWith("SET LOCAL") || ["COMMIT", "ROLLBACK"].includes(text)) { /* transaction control */ }
    else if (!text.startsWith("SELECT")) throw Error("Unexpected mutation");
    else if (this.failQuery) throw Error("private-postgres-url-and-parameters");
    else if (text.includes("information_schema.columns")) {
      rows = Object.values(schema).filter(t => is(t, PgTable)).flatMap(t => Object.values(getTableColumns(t))
        .map(c => ({ table_name: getTableName(t), column_name: c.name })));
      if (this.missingColumn) rows = rows.filter(r => !(r.table_name === "creator_bridge_status" && r.column_name === "last_heartbeat_at"));
    } else if (text.includes("FROM public.creators")) {
      if (!this.missingCreator) rows = [{ id: this.legacyCreator ? "creator_ludylops" : values[0], status: this.disabled ? "disabled" : "active", owner_account: this.missingOwner ? null : this.sameOwner ? "one-private-account" : `private-account-${values[0]}` }];
    } else if (text.includes("FROM public.creator_modules")) {
      rows = ["points", "streamerbot", "ranking", "redemptions"].map(moduleKey => ({ moduleKey, status: moduleKey === this.disabledModule ? "disabled" : "installed", configJson: { chatRewards: { enabled: this.chatEnabled, amount: 5, cooldownSeconds: 60 } } }));
    } else if (text.includes("FROM public.streamerbot_credentials")) {
      rows = Array.from({ length: this.credentialCount }, (_, index) => ({ id: `credential-${index}`, encrypted_secret: encryptCredentialSecret(secret, `credential-${index}`, String(values[0]), this.credentialKey) }));
    } else if (text.includes("FROM public.creator_catalog_items")) rows = [{ available: this.catalogAvailable }];
    else if (text.includes("FROM public.creator_bridge_status")) rows = [{ recent: this.heartbeat }];
    else throw Error("Unexpected query");
    return { rows: rows as T[] };
  }
}

describe("pilot preflight", () => {
  it("reports configuration only, never operational approval or secrets", async () => {
    const db = new Database();
    const result = await runPilotPreflight(db, slugs, settings);
    expect(result).toMatchObject({ configurationReady: true, pilotApproved: false, scope: "database-and-current-process" });
    expect(db.calls[0].text).toBe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    expect(db.calls.at(-1)?.text).toBe("COMMIT");
    expect(JSON.stringify(result)).not.toMatch(/private-|credential-0|encrypted_secret/);
    expect(JSON.stringify(result)).not.toContain(key);
    expect(db.calls.some(c => /^(UPDATE|INSERT|DELETE|CREATE|ALTER|LOCK)/.test(c.text))).toBe(false);
    expect(db.calls.filter(c => c.text.includes("WHERE c.slug")).map(c => c.values)).toEqual([["teste-1"], ["teste-2"]]);
  });
  it("returns missing columns without querying absent tables", async () => {
    const db = new Database(); db.missingColumn = true;
    const report = await runPilotPreflight(db, slugs, settings);
    expect(report.configurationReady).toBe(false);
    expect(report.missingColumns).toEqual(["creator_bridge_status.last_heartbeat_at"]);
    expect(report.communities).toEqual([]);
    expect(db.calls.some(c => c.text.includes("FROM public."))).toBe(false);
  });
  it.each([
    { sameOwner: true }, { missingOwner: true }, { missingCreator: true }, { legacyCreator: true },
    { disabled: true }, { disabledModule: "points" }, { disabledModule: "streamerbot" },
    { disabledModule: "ranking" }, { disabledModule: "redemptions" }, { chatEnabled: false },
    { credentialCount: 0 }, { credentialCount: 2 }, { credentialKey: Buffer.alloc(32, 8).toString("base64") },
    { catalogAvailable: false },
  ])("refuses readiness for %j", async overrides => {
    const db = Object.assign(new Database(), overrides);
    expect(await runPilotPreflight(db, slugs, settings)).toMatchObject({ configurationReady: false, pilotApproved: false });
  });
  it.each([
    { economyEnabled: undefined, encryptionKey: key },
    { economyEnabled: "false", encryptionKey: key },
    { economyEnabled: "true", encryptionKey: undefined },
    { economyEnabled: "true", encryptionKey: "invalid" },
  ])("refuses missing or invalid process configuration %j", async environment => {
    expect((await runPilotPreflight(new Database(), slugs, environment)).configurationReady).toBe(false);
  });
  it("reports heartbeat as an observation, not a configuration or live approval", async () => {
    const db = new Database(); db.heartbeat = false;
    const report = await runPilotPreflight(db, slugs, settings);
    expect(report.configurationReady).toBe(true);
    expect(report.communities.every(c => !c.recentHeartbeat)).toBe(true);
    expect(report.pilotApproved).toBe(false);
  });
  it("rolls back failed snapshots", async () => {
    const db = new Database(); db.failQuery = true;
    await expect(runPilotPreflight(db, slugs, settings)).rejects.toThrow();
    expect(db.calls.at(-1)?.text).toBe("ROLLBACK");
    expect(db.calls.some(c => c.text === "COMMIT")).toBe(false);
  });
});

describe("pilot CLI", () => {
  const setup = () => {
    const db = new Database();
    return { db, dependencies: { loadEnv: vi.fn(() => ({ ...settings, databaseUrl: "postgresql://private-url/database" })), createConnection: vi.fn(() => db), print: vi.fn() } };
  };
  it.each([[], ["one"], ["one", "one"], ["one", "two", "three"], ["one", "--apply"], ["one", "two'; drop table users"], ["one", "A"], ["one", "a".repeat(65)]])("rejects arguments before loading env: %j", async (...args) => {
    const { dependencies } = setup();
    expect(await runPilotCli(args, dependencies)).toBe(2);
    expect(dependencies.loadEnv).not.toHaveBeenCalled();
  });
  it("help never connects", async () => {
    const { dependencies } = setup();
    expect(await runPilotCli(["--help"], dependencies)).toBe(0);
    expect(dependencies.loadEnv).not.toHaveBeenCalled();
  });
  it.each(["", "invalid", "https://private-url"])("rejects invalid URL without exposing it", async databaseUrl => {
    const { dependencies } = setup(); dependencies.loadEnv.mockReturnValue({ ...settings, databaseUrl });
    expect(await runPilotCli(slugs, dependencies)).toBe(2);
    expect(dependencies.createConnection).not.toHaveBeenCalled();
    expect(JSON.stringify(dependencies.print.mock.calls)).not.toContain("private-url");
  });
  it("returns 0 for configuration and 1 for blockers, always closing", async () => {
    const { db, dependencies } = setup();
    expect(await runPilotCli(slugs, dependencies)).toBe(0);
    db.sameOwner = true;
    expect(await runPilotCli(slugs, dependencies)).toBe(1);
    expect(db.end).toHaveBeenCalledTimes(2);
  });
  it.each(["connect", "query", "end"])("sanitizes %s failures and closes", async stage => {
    const { db, dependencies } = setup();
    if (stage === "query") db.failQuery = true;
    else db[stage as "connect" | "end"].mockRejectedValue(Error("private-url"));
    expect(await runPilotCli(slugs, dependencies)).toBe(1);
    expect(db.end).toHaveBeenCalledOnce();
    expect(JSON.stringify(dependencies.print.mock.calls)).not.toContain("private-");
  });
});
