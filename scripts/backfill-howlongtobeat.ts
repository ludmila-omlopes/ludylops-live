import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";

import { hltbAdapter } from "../src/lib/hltb";

type GameSuggestionRow = {
  id: string;
  name: string;
  canonical_name: string | null;
  platforms: unknown;
};

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ENV_FILES = [resolve(ROOT, ".env.local"), resolve(ROOT, ".env")];
const DEFAULT_LIMIT = 100;

function loadEnvFile(filepath: string) {
  if (!existsSync(filepath)) {
    return;
  }

  const raw = readFileSync(filepath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function loadLocalEnv() {
  for (const filepath of ENV_FILES) {
    loadEnvFile(filepath);
  }
}

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const allStatuses = process.argv.includes("--all-statuses");
  const verbose = process.argv.includes("--verbose");
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const parsedLimit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : DEFAULT_LIMIT;

  return {
    allStatuses,
    dryRun,
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT,
    verbose,
  };
}

function getSearchTitle(row: GameSuggestionRow) {
  return (row.canonical_name ?? row.name).trim();
}

function getPlatformName(platforms: unknown) {
  return Array.isArray(platforms) && typeof platforms[0] === "string"
    ? platforms[0]
    : null;
}

async function main() {
  loadLocalEnv();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL. Add it to .env.local/.env or export it before running.");
  }

  const { allStatuses, dryRun, limit, verbose } = parseArgs();
  const sql = neon(databaseUrl);
  const rows = (await sql`
    SELECT id, name, canonical_name, platforms
    FROM game_suggestions
    WHERE hltb_id IS NULL
      AND hltb_main_story_minutes IS NULL
      AND hltb_main_extra_minutes IS NULL
      AND hltb_completionist_minutes IS NULL
      AND (
        hltb_fetched_at IS NULL
        OR hltb_fetched_at < NOW() - INTERVAL '15 minutes'
      )
      AND (${allStatuses} OR status IN ('open', 'accepted'))
    ORDER BY total_votes DESC, created_at DESC
    LIMIT ${limit}
  `) as GameSuggestionRow[];

  if (rows.length === 0) {
    console.info("No game suggestions need HLTB backfill.");
    return;
  }

  console.info(`Found ${rows.length} game suggestions to inspect.`);

  let updated = 0;
  let unresolved = 0;

  for (const row of rows) {
    const title = getSearchTitle(row);
    const platformName = getPlatformName(row.platforms);
    const match = await hltbAdapter.searchBestMatch({ title, platformName });

    if (!match) {
      unresolved += 1;
      if (verbose) {
        console.warn(`No HLTB match for ${row.id}: ${title}`);
      }

      if (!dryRun) {
        await sql`
          UPDATE game_suggestions
          SET hltb_fetched_at = NOW()
          WHERE id = ${row.id}
        `;
      }
      continue;
    }

    updated += 1;
    if (dryRun || verbose) {
      console.info(`${dryRun ? "[dry-run] " : ""}${row.id}: ${title} -> ${match.title} (${match.hltbId})`);
    }

    if (dryRun) {
      continue;
    }

    await sql`
      UPDATE game_suggestions
      SET hltb_id = ${match.hltbId},
          hltb_name = ${match.title},
          hltb_main_story_minutes = ${match.mainStoryMinutes},
          hltb_main_extra_minutes = ${match.mainExtraMinutes},
          hltb_completionist_minutes = ${match.completionistMinutes},
          hltb_similarity = ${Math.round(match.score)},
          hltb_fetched_at = NOW()
      WHERE id = ${row.id}
    `;
  }

  console.info(
    dryRun
      ? `Dry run complete. Would update ${updated}; unresolved ${unresolved}.`
      : `Backfill complete. Updated ${updated}; unresolved ${unresolved}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
