import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";

type UserRow = {
  id: string;
  email: string | null;
  google_user_id: string | null;
  youtube_channel_id: string;
  youtube_display_name: string;
  is_linked: boolean;
  created_at: string;
};

type BalanceRow = {
  viewer_id: string;
  current_balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
};

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ENV_FILES = [resolve(ROOT, ".env.local"), resolve(ROOT, ".env")];

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

function pickTarget(users: UserRow[]) {
  return [...users].sort((left, right) => {
    const leftScore = Number(Boolean(left.email)) * 4 + Number(Boolean(left.google_user_id)) * 2 + Number(left.is_linked);
    const rightScore = Number(Boolean(right.email)) * 4 + Number(Boolean(right.google_user_id)) * 2 + Number(right.is_linked);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    return +new Date(left.created_at) - +new Date(right.created_at);
  })[0]!;
}

async function main() {
  loadLocalEnv();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL.");
  }

  const sql = neon(databaseUrl);
  if ((await sql`SELECT to_regclass('public.creator_balances') AS storage`)[0]?.storage) {
    throw new Error("This legacy merge script is disabled after the creator economy migration. Use the application account-linking flow, which transfers each currency atomically.");
  }
  const duplicates = (await sql`
    SELECT youtube_channel_id
    FROM users
    GROUP BY youtube_channel_id
    HAVING COUNT(*) > 1
  `) as Array<{ youtube_channel_id: string }>;

  if (duplicates.length === 0) {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_youtube_channel_id_idx ON users (youtube_channel_id)`;
    console.info("No duplicate youtube_channel_id rows found. Unique index ensured.");
    return;
  }

  let mergedGroups = 0;

  for (const duplicate of duplicates) {
    const users = (await sql`
      SELECT id, email, google_user_id, youtube_channel_id, youtube_display_name, is_linked, created_at
      FROM users
      WHERE youtube_channel_id = ${duplicate.youtube_channel_id}
      ORDER BY created_at ASC
    `) as UserRow[];

    const target = pickTarget(users);
    const sources = users.filter((user) => user.id !== target.id);

    for (const source of sources) {
      const [sourceBalance] = (await sql`
        SELECT viewer_id, current_balance, lifetime_earned, lifetime_spent
        FROM viewer_balances
        WHERE viewer_id = ${source.id}
        LIMIT 1
      `) as BalanceRow[];
      const [targetBalance] = (await sql`
        SELECT viewer_id, current_balance, lifetime_earned, lifetime_spent
        FROM viewer_balances
        WHERE viewer_id = ${target.id}
        LIMIT 1
      `) as BalanceRow[];

      const conflictingBetEntries = (await sql`
        SELECT source.bet_id
        FROM bet_entries source
        INNER JOIN bet_entries target
          ON target.bet_id = source.bet_id
         AND target.viewer_id = ${target.id}
        WHERE source.viewer_id = ${source.id}
      `) as Array<{ bet_id: string }>;

      if (conflictingBetEntries.length > 0) {
        throw new Error(`Cannot auto-merge ${source.id} into ${target.id}: duplicate bet entries found.`);
      }

      await sql`UPDATE point_ledger SET viewer_id = ${target.id} WHERE viewer_id = ${source.id}`;
      await sql`UPDATE redemptions SET viewer_id = ${target.id} WHERE viewer_id = ${source.id}`;
      await sql`UPDATE bet_entries SET viewer_id = ${target.id} WHERE viewer_id = ${source.id}`;

      await sql`
        UPDATE viewer_balances
        SET
          current_balance = ${(targetBalance?.current_balance ?? 0) + (sourceBalance?.current_balance ?? 0)},
          lifetime_earned = ${(targetBalance?.lifetime_earned ?? 0) + (sourceBalance?.lifetime_earned ?? 0)},
          lifetime_spent = ${(targetBalance?.lifetime_spent ?? 0) + (sourceBalance?.lifetime_spent ?? 0)},
          last_synced_at = NOW()
        WHERE viewer_id = ${target.id}
      `;

      await sql`DELETE FROM viewer_balances WHERE viewer_id = ${source.id}`;
      await sql`DELETE FROM users WHERE id = ${source.id}`;
    }

    mergedGroups += 1;
  }

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_youtube_channel_id_idx ON users (youtube_channel_id)`;
  console.info(`Merged ${mergedGroups} duplicate youtube_channel_id groups and ensured the unique index.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
