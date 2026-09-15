import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { Client, neonConfig, type WebSocketConstructor } from "@neondatabase/serverless";
import ws from "ws";

import { BaselineError, runCreatorBaseline, type BaselineConnection } from "../src/lib/db/creator-baseline";
import { loadDatabaseEnv } from "./database-env";

type Connection = BaselineConnection & { connect(): Promise<void>; end(): Promise<void> };
type Dependencies = {
  loadEnv(): string | undefined;
  createConnection(url: string): Connection;
  print(message: string): void;
};

const defaults: Dependencies = {
  loadEnv: loadDatabaseEnv,
  createConnection: (connectionString) => {
    neonConfig.webSocketConstructor = ws as WebSocketConstructor;
    return new Client({ connectionString, connectionTimeoutMillis: 10_000, query_timeout: 20_000 });
  },
  print: (message) => console.info(message),
};

// No environment loading or connection on import. All output is an allowlist.
export async function runBaselineCli(args: string[], dependencies: Dependencies = defaults): Promise<number> {
  const usage = "Usage: npm run db:baseline:check | npm run db:baseline:ensure -- --apply";
  const [mode, ...flags] = args;
  if (args.length === 1 && mode === "--help") { dependencies.print(usage); return 0; }
  if (!((mode === undefined && flags.length === 0)
    || (mode === "check" && flags.length === 0)
    || (mode === "ensure" && (flags.length === 0 || (flags.length === 1 && flags[0] === "--apply"))))) {
    dependencies.print(usage); return 2;
  }
  if (mode === "ensure" && flags.length === 0) {
    dependencies.print("Ensure refused: explicit --apply is required. Use db:baseline:check for a read-only report.");
    return 2;
  }
  let connection: Connection | undefined;
  let exitCode = 1;
  try {
    const databaseUrl = dependencies.loadEnv()?.trim();
    if (!databaseUrl) { dependencies.print("Missing DATABASE_URL; no database connection attempted."); return 2; }
    let validUrl = false;
    try { validUrl = ["postgres:", "postgresql:"].includes(new URL(databaseUrl).protocol); } catch { /* sanitized below */ }
    if (!validUrl) { dependencies.print("Invalid DATABASE_URL; expected a PostgreSQL URL."); return 2; }
    connection = dependencies.createConnection(databaseUrl);
    await connection.connect();
    const report = await runCreatorBaseline(connection, mode === "ensure");
    dependencies.print(JSON.stringify(report));
    exitCode = report.ready ? 0 : 1;
  } catch (error) {
    dependencies.print(error instanceof BaselineError
      ? `Baseline failed: ${error.code}. See docs/database-migrations.md.`
      : "Baseline failed: connection, permissions, schema shape or transaction error. No readiness certified; investigate securely.");
  } finally {
    if (connection) {
      try { await connection.end(); } catch { dependencies.print("Database connection cleanup failed."); exitCode = 1; }
    }
  }
  return exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void runBaselineCli(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
