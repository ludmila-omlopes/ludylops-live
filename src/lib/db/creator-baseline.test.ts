import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CREATOR, DEFAULT_CREATOR_BRANDING, DEFAULT_CREATOR_DOMAINS, DEFAULT_CREATOR_MODULES } from "../creators/defaults";
import { runBaselineCli } from "../../../scripts/creator-baseline";
import { baselineSeed as seed, BaselineError, runCreatorBaseline, type BaselineConnection } from "./creator-baseline";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
// Transactional adapter fake: interprets emitted SQL/parameters, not seed rules.
// No network or real database. Unexpected SQL always fails the test.
class Database implements BaselineConnection {
  tables: Tables = { creators: [], creator_domains: [], creator_branding: [], creator_modules: [] };
  calls: { text: string; values: unknown[] }[] = [];
  snapshot?: Tables;
  failInsert = 0;
  insertCount = 0;
  missingSchema = false;
  missingColumn = false;
  ignoreInsert = false;
  readOnly = false;
  connect = vi.fn(async () => undefined);
  end = vi.fn(async () => undefined);

  async query<T extends Row = Row>(text: string, values: unknown[] = []): Promise<{ rows: T[] }> {
    this.calls.push({ text, values });
    let rows: Row[] = [];
    if (text.startsWith("BEGIN")) { this.snapshot = structuredClone(this.tables); this.readOnly = text.includes("READ ONLY"); }
    else if (text === "ROLLBACK") { this.tables = this.snapshot!; }
    else if (text === "COMMIT" || text.startsWith("SET LOCAL") || text.startsWith("LOCK TABLE")) { /* control */ }
    else if (text.startsWith("SELECT to_regclass")) rows = [{ ready: !this.missingSchema }];
    else if (text.includes("FROM information_schema.columns")) {
      const columns = {
        creators: "id slug display_name owner_user_id status created_at updated_at",
        creator_domains: "id creator_id hostname is_primary created_at",
        creator_branding: "creator_id logo_url avatar_url primary_color secondary_color background_color accent_color font_heading font_body border_radius theme_json updated_at",
        creator_modules: "id creator_id module_key status config_json installed_at updated_at",
      };
      rows = Object.entries(columns).flatMap(([table_name, names]) => names.split(" ").map((column_name) => ({ table_name, column_name })));
      if (this.missingColumn) rows.pop();
    } else if (text.startsWith("SELECT ")) {
      const table = text.match(/FROM public\.(\w+)/)?.[1];
      if (!table) throw new Error(`Unexpected query: ${text}`);
      rows = this.tables[table].filter((row) => {
        if (table === "creators") return row.id === values[0] || row.slug === values[1];
        if (table === "creator_domains") return row.creator_id === values[0] || row.id === values[1] || row.hostname === values[2];
        if (table === "creator_modules") return row.creator_id === values[0] || (values[1] as string[]).includes(row.id as string);
        return row.creator_id === values[0];
      });
    } else if (text.startsWith("INSERT INTO")) {
      if (this.readOnly) throw new Error("Write in read-only transaction");
      if (++this.insertCount === this.failInsert) throw new Error("private database error");
      const match = text.match(/INSERT INTO public\.(\w+) \((.+)\) VALUES \((.+)\)/)!;
      const row: Row = { created_at: "now", updated_at: "now" };
      match[2].split(", ").forEach((column, index) => {
        const expression = match[3].split(", ")[index];
        const parameter = expression.match(/^\$(\d+)/);
        row[column] = parameter ? values[Number(parameter[1]) - 1] : expression === "NULL" ? null : expression.replaceAll("'", "");
      });
      if (!this.ignoreInsert) this.tables[match[1]].push(row);
    } else throw new Error(`Unexpected query: ${text}`);
    return { rows: structuredClone(rows) as T[] };
  }
}

const insertCalls = (db: Database) => db.calls.filter(({ text }) => text.startsWith("INSERT"));

describe("creator baseline v1", () => {
  it("captures the existing defaults without synthetic demo timestamps", () => {
    expect([seed.creatorId, seed.slug, seed.displayName]).toEqual([DEFAULT_CREATOR.id, DEFAULT_CREATOR.slug, DEFAULT_CREATOR.displayName]);
    expect([seed.domainId, seed.hostname]).toEqual([DEFAULT_CREATOR_DOMAINS[0].id, DEFAULT_CREATOR_DOMAINS[0].hostname]);
    expect(seed.branding).toEqual([
      DEFAULT_CREATOR_BRANDING.primaryColor, DEFAULT_CREATOR_BRANDING.secondaryColor,
      DEFAULT_CREATOR_BRANDING.backgroundColor, DEFAULT_CREATOR_BRANDING.accentColor,
      DEFAULT_CREATOR_BRANDING.fontHeading, DEFAULT_CREATOR_BRANDING.fontBody,
      DEFAULT_CREATOR_BRANDING.borderRadius, JSON.stringify(DEFAULT_CREATOR_BRANDING.themeJson),
    ]);
    expect(seed.modules).toEqual(DEFAULT_CREATOR_MODULES.map((module) => [module.moduleKey, module.configJson]));
  });

  it("checks an empty foundation using a read-only snapshot with no locks or writes", async () => {
    const db = new Database();
    const report = await runCreatorBaseline(db);
    expect(report).toMatchObject({ ready: false, creatorExists: false, inserted: 0 });
    expect(report.missing).toHaveLength(14);
    expect(db.calls[0].text).toBe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    expect(insertCalls(db)).toHaveLength(0);
    expect(db.calls.some(({ text }) => text.startsWith("LOCK"))).toBe(false);
    expect(db.calls.at(-1)?.text).toBe("COMMIT");
  });

  it("inserts empty state atomically using bound parameters and is a repeated no-op", async () => {
    const db = new Database();
    expect(await runCreatorBaseline(db, true)).toMatchObject({ ready: true, creatorExists: true, inserted: 14 });
    const inserts = insertCalls(db);
    expect(inserts).toHaveLength(14);
    expect(inserts.every(({ text }) => text.includes("$1") && !text.includes(seed.creatorId) && !text.includes("ON CONFLICT"))).toBe(true);
    expect(db.calls.findIndex(({ text }) => text.startsWith("LOCK"))).toBeLessThan(db.calls.findIndex(({ text }) => text.startsWith("INSERT")));
    expect(db.tables.creator_modules.find((row) => row.module_key === "quotes")?.config_json).toBe('{"displayDurationSeconds":12}');
    const before = structuredClone(db.tables);
    db.calls = [];
    expect(await runCreatorBaseline(db, true)).toMatchObject({ ready: true, inserted: 0 });
    expect(db.tables).toEqual(before);
    expect(insertCalls(db)).toHaveLength(0);
  });

  it("preserves all customized fields, timestamps, natural-key rows with different ids and disabled modules", async () => {
    const db = new Database();
    await runCreatorBaseline(db, true);
    Object.assign(db.tables.creators[0], { slug: "custom", display_name: "Minha live", owner_user_id: "owner", status: "archived", updated_at: "yesterday" });
    Object.assign(db.tables.creator_branding[0], { primary_color: "#123456", theme_json: { custom: true }, updated_at: "yesterday" });
    Object.assign(db.tables.creator_domains[0], { id: "custom-domain-id", is_primary: false });
    Object.assign(db.tables.creator_modules[0], { id: "custom-module-id", status: "disabled", config_json: { currencyLabel: "outra" }, updated_at: "yesterday" });
    const before = structuredClone(db.tables);
    db.calls = [];
    expect(await runCreatorBaseline(db)).toMatchObject({ ready: true });
    expect(await runCreatorBaseline(db, true)).toMatchObject({ ready: true, inserted: 0 });
    expect(db.tables).toEqual(before);
    expect(insertCalls(db)).toHaveLength(0);
  });

  it("fills only missing records and preserves a custom primary domain", async () => {
    const db = new Database();
    await runCreatorBaseline(db, true);
    db.tables.creator_branding = [];
    db.tables.creator_modules.pop();
    db.tables.creator_domains = [{ id: "custom", creator_id: seed.creatorId, hostname: "custom.example", is_primary: true, created_at: "yesterday" }];
    db.calls = [];
    expect(await runCreatorBaseline(db, true)).toMatchObject({ ready: true, inserted: 3 });
    expect(insertCalls(db).map(({ text }) => text.match(/public\.(\w+)/)?.[1])).toEqual(["creator_branding", "creator_domains", "creator_modules"]);
    expect(db.tables.creator_domains.map((row) => row.is_primary)).toEqual([true, false]);
    expect(db.tables.creator_domains[0].created_at).toBe("yesterday");
  });

  it.each([
    ["creators", { id: "other", slug: seed.slug }],
    ["creator_domains", { id: "other", creator_id: "other", hostname: seed.hostname }],
    ["creator_domains", { id: seed.domainId, creator_id: "other", hostname: "other.example" }],
    ["creator_domains", { id: seed.domainId, creator_id: seed.creatorId, hostname: "custom.example" }],
    ["creator_modules", { id: "creator_module_ludylops_quotes", creator_id: "other", module_key: "quotes" }],
    ["creator_modules", { id: "creator_module_ludylops_quotes", creator_id: seed.creatorId, module_key: "points" }],
  ] as const)("rejects identity collisions in %s before any mutation", async (table, row) => {
    for (const apply of [false, true]) {
      const db = new Database();
      db.tables[table].push(row);
      const before = structuredClone(db.tables);
      await expect(runCreatorBaseline(db, apply)).rejects.toMatchObject({ code: "identity_conflict" });
      expect(insertCalls(db)).toHaveLength(0);
      expect(db.tables).toEqual(before);
      expect(db.calls.at(-1)?.text).toBe("ROLLBACK");
    }
  });

  it.each(["missingSchema", "missingColumn"] as const)("rejects %s without creating schema or writing", async (property) => {
    const db = new Database(); db[property] = true;
    await expect(runCreatorBaseline(db, true)).rejects.toMatchObject({ code: "schema_missing" });
    expect(insertCalls(db)).toHaveLength(0);
    expect(db.calls.some(({ text }) => /^(CREATE|ALTER)/.test(text))).toBe(false);
  });

  it("rolls back prior inserts on mid-transaction failure", async () => {
    const db = new Database(); db.failInsert = 4;
    const before = structuredClone(db.tables);
    await expect(runCreatorBaseline(db, true)).rejects.toThrow("private database error");
    expect(db.tables).toEqual(before);
    expect(db.calls.at(-1)?.text).toBe("ROLLBACK");
    expect(db.calls.some(({ text }) => text === "COMMIT")).toBe(false);
  });

  it("verifies postconditions before commit", async () => {
    const db = new Database(); db.ignoreInsert = true;
    await expect(runCreatorBaseline(db, true)).rejects.toBeInstanceOf(BaselineError);
    expect(db.calls.at(-1)?.text).toBe("ROLLBACK");
  });
});

describe("baseline CLI", () => {
  function setup(url: string | undefined = "postgresql://example.invalid/test") {
    const db = new Database();
    const dependencies = { loadEnv: vi.fn((): string | undefined => url), createConnection: vi.fn(() => db), print: vi.fn() };
    return { db, dependencies };
  }
  it.each([["ensure"], ["check", "--apply"], ["ensure", "--apply", "--apply"], ["--url", "secret"], ["unknown"]])("rejects unsafe/invalid args %j before environment loading", async (...args) => {
    const { dependencies } = setup();
    expect(await runBaselineCli(args, dependencies)).toBe(2);
    expect(dependencies.loadEnv).not.toHaveBeenCalled();
    expect(dependencies.createConnection).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "  ", "secret-not-a-url", "https://secret.example"])("rejects absent/invalid credentials without connecting (%s)", async (url) => {
    const { dependencies } = setup(); dependencies.loadEnv.mockReturnValue(url);
    expect(await runBaselineCli(["check"], dependencies)).toBe(2);
    expect(dependencies.createConnection).not.toHaveBeenCalled();
    expect(JSON.stringify(dependencies.print.mock.calls)).not.toContain("secret");
  });
  it("defaults to check, reports non-readiness and closes the connection", async () => {
    const { db, dependencies } = setup();
    expect(await runBaselineCli([], dependencies)).toBe(1);
    expect(insertCalls(db)).toHaveLength(0);
    expect(db.end).toHaveBeenCalledOnce();
  });
  it("requires explicit apply for ensure and prints only readiness metadata", async () => {
    const { db, dependencies } = setup();
    expect(await runBaselineCli(["ensure", "--apply"], dependencies)).toBe(0);
    expect(db.end).toHaveBeenCalledOnce();
    expect(JSON.parse(dependencies.print.mock.calls[0][0])).toMatchObject({ ready: true, inserted: 14 });
  });
  it("redacts connection/SQL errors, rolls back and closes", async () => {
    const { db, dependencies } = setup(); db.failInsert = 2;
    expect(await runBaselineCli(["ensure", "--apply"], dependencies)).toBe(1);
    expect(JSON.stringify(dependencies.print.mock.calls)).not.toContain("private database error");
    expect(db.calls.at(-1)?.text).toBe("ROLLBACK");
    expect(db.end).toHaveBeenCalledOnce();
  });
  it("closes even when connect fails and never prints the URL", async () => {
    const { db, dependencies } = setup(); db.connect.mockRejectedValue(new Error("postgresql://secret"));
    expect(await runBaselineCli(["check"], dependencies)).toBe(1);
    expect(db.end).toHaveBeenCalledOnce();
    expect(JSON.stringify(dependencies.print.mock.calls)).not.toContain("secret");
  });
});
