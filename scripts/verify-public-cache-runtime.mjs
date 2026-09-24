// Runs the real cache helper in a disposable Next production app, without a database.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const repo = process.cwd();
// Keep Next and its fixture on the same Windows drive. The generated app is ignored.
const fixtureParent = fs.realpathSync(repo);
const root = fs.mkdtempSync(path.join(fixtureParent, ".cache-runtime-"));
const env = { ...process.env };
for (const name of fs.readdirSync(repo).filter((name) => /^\.env($|\.)/.test(name))) {
  for (const match of fs.readFileSync(path.join(repo, name), "utf8").matchAll(/^([A-Za-z_][A-Za-z0-9_]*)=/gm)) delete env[match[1]];
}
Object.assign(env, { DATABASE_URL: "postgresql://cache_fixture@127.0.0.1/unused", NEXTAUTH_SECRET: "isolated-cache-runtime",
  NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "production" });
const next = path.join(repo, "node_modules/next/dist/bin/next");
const logPath = path.join(root, "runtime.log");
const log = fs.openSync(logPath, "w");
let server;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (args, extra = {}) => spawn(process.execPath, [next, ...args], { cwd: root, env: { ...env, ...extra }, windowsHide: true, stdio: ["ignore", log, log] });
async function stop() {
  if (!server || server.exitCode !== null) return;
  server.kill(); await new Promise((resolve) => server.once("exit", resolve));
}
async function start(extra = {}) {
  server = run(["start", "-H", "127.0.0.1", "-p", "3391"], extra);
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error("Fixture server stopped");
    try { if ((await fetch("http://127.0.0.1:3391")).ok) return; } catch { /* Startup only. */ }
    await pause(250);
  }
  throw new Error("Fixture startup timed out");
}
const base = "http://127.0.0.1:3391/probe";
async function read(creator = "a", limit = 100) {
  const response = await fetch(`${base}?creator=${creator}&limit=${limit}`);
  return { status: response.status, ...(await response.json()) };
}
async function update(input) {
  assert.equal((await fetch(base, { method: "POST", body: JSON.stringify(input) })).status, 200);
}

try {
  fs.symlinkSync(path.join(repo, "node_modules"), path.join(root, "node_modules"), "junction");
  fs.mkdirSync(path.join(root, "app/probe"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "public-cache-runtime", private: true }));
  fs.writeFileSync(path.join(root, "next.config.mjs"), `export default { webpack(config) { config.resolve.alias["@"] = ${JSON.stringify(path.join(repo, "src"))}; return config; } };`);
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: {
    target: "ES2022", lib: ["dom", "esnext"], jsx: "preserve", module: "esnext", moduleResolution: "bundler",
    esModuleInterop: true, skipLibCheck: true, strict: true, noEmit: true,
    baseUrl: repo, paths: { "@/*": ["src/*"] },
  }, include: ["app/**/*", ".next/types/**/*.ts"] }));
  fs.writeFileSync(path.join(root, "app/layout.tsx"), 'export default function Layout({children}: {children: React.ReactNode}) { return <html><body>{children}</body></html>; }');
  fs.writeFileSync(path.join(root, "app/page.tsx"), 'export default function Page() { return <p>Cache runtime fixture</p>; }');
  fs.writeFileSync(path.join(root, "app/probe/route.ts"), `
import { cachePublicCreatorRead } from "@/lib/cache";
export const dynamic = "force-dynamic";
const state: Record<string, {version: number; enabled: boolean; calls: number}> = {};
const entry = (id: string) => state[id] ??= {version: 1, enabled: true, calls: 0};
const cached = cachePublicCreatorRead("runtime-probe", 15, async ({creatorId}, limit: number) => {
  const row = entry(creatorId); row.calls++;
  return {creatorId, limit, version: row.version};
});
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const creatorId = query.get("creator") ?? "a", row = entry(creatorId);
  if (!row.enabled) return Response.json({calls: row.calls}, {status: 403});
  const data = await cached({creatorId}, Number(query.get("limit") ?? 100));
  return Response.json({data, calls: row.calls}, {headers: {"Cache-Control": "no-store"}});
}
export async function POST(request: Request) {
  const {creator = "a", version, enabled} = await request.json();
  Object.assign(entry(creator), version === undefined ? {} : {version}, enabled === undefined ? {} : {enabled});
  return Response.json({ok:true});
}
`);
  const build = run(["build", "--webpack"]);
  const code = await new Promise((resolve) => build.once("exit", resolve));
  assert.equal(code, 0, "Fixture production build");
  await start();
  const first = await read(); assert.equal(first.calls, 1); assert.equal(first.data.version, 1);
  assert.equal((await read()).calls, 1);
  const other = await read("b"); assert.equal(other.data.creatorId, "b"); assert.equal(other.calls, 1);
  assert.equal((await read("a", 10)).data.limit, 10); assert.equal((await read()).calls, 2);
  await update({ version: 2 }); assert.equal((await read()).data.version, 1);
  await update({ enabled: false }); assert.equal((await read()).status, 403);
  await update({ enabled: true }); assert.equal((await read()).data.version, 1);
  await pause(16000);
  const expired = await read(); // Next may serve stale once while it revalidates in the background.
  let refreshed = expired;
  for (let i = 0; i < 30 && refreshed.data.version !== 2; i++) { await pause(200); refreshed = await read(); }
  assert.equal(refreshed.data.version, 2); assert.equal(refreshed.data.creatorId, "a");
  assert(refreshed.calls > 2);
  await stop();
  await start({ DATABASE_URL: "" });
  const demoFirst = await read(); await update({ version: 9 }); const demoNext = await read();
  assert.equal(demoFirst.data.version, 1); assert.equal(demoNext.data.version, 9); assert.equal(demoNext.calls, 2);
  console.log(JSON.stringify({ framework: "Next production build", warmHit: true, creatorIsolation: true, queryIsolation: true,
    denialBeforeWarmCache: true, revalidatedAfter15s: true, firstExpiredVersion: expired.data.version,
    freshVersion: refreshed.data.version, demoBypass: true }));
} catch (error) {
  console.error(error);
  if (fs.existsSync(logPath)) console.error(fs.readFileSync(logPath, "utf8").slice(-6000));
  process.exitCode = 1;
} finally {
  await stop(); fs.closeSync(log);
  // Only delete this mkdtemp directory. Remove the dependency junction first.
  if (path.dirname(fs.realpathSync(root)) !== fixtureParent || !path.basename(root).startsWith(".cache-runtime-"))
    throw new Error("Unexpected fixture cleanup path");
  if (fs.existsSync(path.join(root, "node_modules"))) fs.unlinkSync(path.join(root, "node_modules"));
  fs.rmSync(root, { recursive: true, force: true });
}
