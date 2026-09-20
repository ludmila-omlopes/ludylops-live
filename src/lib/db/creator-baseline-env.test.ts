import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const loader = pathToFileURL(resolve("node_modules/tsx/dist/loader.mjs")).href;
const envHelper = resolve("scripts/database-env.ts");
const cli = resolve("scripts/creator-baseline.ts");

function child(code: string, directory: string, databaseUrl?: string, nodeEnv: "production" | "development" | "test" = "production") {
  const childEnv: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: nodeEnv };
  delete childEnv.__NEXT_PROCESSED_ENV;
  delete childEnv.DATABASE_URL;
  if (databaseUrl !== undefined) childEnv.DATABASE_URL = databaseUrl;
  return spawnSync(process.execPath, ["--import", loader, "-e", code], {
    cwd: directory, env: childEnv, encoding: "utf8", timeout: 15_000,
  });
}

describe("baseline environment and entry point", () => {
  it("uses Next env file priority, expands values and preserves shell overrides including empty", () => {
    const directory = mkdtempSync(join(tmpdir(), "creator-baseline-"));
    try {
      writeFileSync(join(directory, ".env"), "BASELINE_HOST=base.invalid\nDATABASE_URL=postgresql://$BASELINE_HOST/base\n");
      writeFileSync(join(directory, ".env.local"), 'DATABASE_URL="postgresql://local.invalid/local"\n');
      writeFileSync(join(directory, ".env.production.local"), "DATABASE_URL=postgresql://production.invalid/production\n");
      const code = `process.stdout.write(JSON.stringify(require(${JSON.stringify(envHelper)}).loadDatabaseEnv()))`;
      expect(child(code, directory).stdout).toBe('"postgresql://production.invalid/production"');
      expect(child(code, directory, undefined, "test").stdout).toBe('"postgresql://base.invalid/base"');
      expect(child(code, directory, "postgresql://shell.invalid/shell").stdout).toBe('"postgresql://shell.invalid/shell"');
      expect(child(code, directory, "").stdout).toBe('""');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("importing the CLI neither loads env nor runs main", () => {
    const result = child(`require(${JSON.stringify(cli)}); process.stdout.write("imported")`, tmpdir(), "invalid-secret");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("imported");
    expect(result.stderr).not.toContain("invalid-secret");
  });

  it("the real executable returns exit 2 without credentials", () => {
    const result = spawnSync(process.execPath, ["--import", loader, cli, "check"], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: "" }, encoding: "utf8", timeout: 15_000,
    });
    expect(result.status).toBe(2);
    expect(result.stdout).toContain("Missing DATABASE_URL");
  });
});
