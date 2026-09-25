import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client, neonConfig, type WebSocketConstructor } from "@neondatabase/serverless";
import ws from "ws";
import { runPilotPreflight, validPilotSlugs, type PilotEnvironment } from "../src/lib/creators/pilot-preflight";
import type { BaselineConnection } from "../src/lib/db/creator-baseline";
import { loadDatabaseEnv } from "./database-env";

type Connection = BaselineConnection & { connect(): Promise<void>; end(): Promise<void> };
type Dependencies = {
  loadEnv(): PilotEnvironment & { databaseUrl?: string };
  createConnection(url: string): Connection;
  print(message: string): void;
};
const defaults: Dependencies = {
  loadEnv: () => ({ databaseUrl: loadDatabaseEnv(), economyEnabled: process.env.CREATOR_ECONOMY_ENABLED, encryptionKey: process.env.STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY }),
  createConnection: connectionString => {
    neonConfig.webSocketConstructor = ws as WebSocketConstructor;
    return new Client({ connectionString, connectionTimeoutMillis: 10_000, query_timeout: 20_000 });
  },
  print: message => console.info(message),
};

export async function runPilotCli(args: string[], dependencies: Dependencies = defaults) {
  const usage = "Uso: npm run pilot:check -- <slug-1> <slug-2>. Somente leitura; verifica o banco e as variáveis deste processo, não o deployment remoto.";
  if (args.length === 1 && args[0] === "--help") { dependencies.print(usage); return 0; }
  if (!validPilotSlugs(args)) { dependencies.print(usage); return 2; }
  let connection: Connection | undefined;
  let code = 1;
  try {
    const environment = dependencies.loadEnv();
    const url = environment.databaseUrl?.trim();
    let valid = false;
    try { valid = Boolean(url && ["postgres:", "postgresql:"].includes(new URL(url).protocol)); } catch { /* sanitized below */ }
    if (!valid || !url) { dependencies.print("DATABASE_URL ausente ou inválida; nenhuma conexão foi tentada."); return 2; }
    connection = dependencies.createConnection(url);
    await connection.connect();
    const report = await runPilotPreflight(connection, args, environment);
    dependencies.print(JSON.stringify(report));
    code = report.configurationReady ? 0 : 1;
  } catch {
    dependencies.print("Não foi possível verificar o piloto. Confira conexão, permissões e schema; nenhum aceite foi registrado.");
  } finally {
    if (connection) try { await connection.end(); } catch { dependencies.print("Falha ao encerrar a conexão."); code = 1; }
  }
  return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void runPilotCli(process.argv.slice(2)).then(code => { process.exitCode = code; });
}
