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
  youtube_handle: string | null;
  avatar_url: string | null;
  is_linked: boolean;
  exclude_from_ranking: boolean;
  created_at: string;
};

type BalanceRow = {
  viewer_id: string;
  current_balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  last_synced_at: string;
};

type GoogleAccountViewerRow = {
  id: string;
  google_account_id: string;
  viewer_id: string;
};

type MergeArgs = {
  sourceViewerId: string;
  targetViewerId: string;
  dryRun: boolean;
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

function parseArgs(argv: string[]): MergeArgs {
  let sourceViewerId = "";
  let targetViewerId = "";
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source-viewer") {
      sourceViewerId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--target-viewer") {
      targetViewerId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
  }

  if (!sourceViewerId || !targetViewerId) {
    throw new Error(
      "Usage: npm run merge:viewers -- --source-viewer <viewer-id> --target-viewer <viewer-id> [--dry-run]",
    );
  }
  if (sourceViewerId === targetViewerId) {
    throw new Error("Source and target viewer ids must be different.");
  }

  return { sourceViewerId, targetViewerId, dryRun };
}

async function main() {
  loadLocalEnv();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL.");
  }

  const args = parseArgs(process.argv.slice(2));
  const sql = neon(databaseUrl);

  const [sourceViewer] = (await sql`
    SELECT
      id,
      email,
      google_user_id,
      youtube_channel_id,
      youtube_display_name,
      youtube_handle,
      avatar_url,
      is_linked,
      exclude_from_ranking,
      created_at
    FROM users
    WHERE id = ${args.sourceViewerId}
    LIMIT 1
  `) as UserRow[];
  const [targetViewer] = (await sql`
    SELECT
      id,
      email,
      google_user_id,
      youtube_channel_id,
      youtube_display_name,
      youtube_handle,
      avatar_url,
      is_linked,
      exclude_from_ranking,
      created_at
    FROM users
    WHERE id = ${args.targetViewerId}
    LIMIT 1
  `) as UserRow[];

  if (!sourceViewer) {
    throw new Error(`Source viewer ${args.sourceViewerId} was not found.`);
  }
  if (!targetViewer) {
    throw new Error(`Target viewer ${args.targetViewerId} was not found.`);
  }

  const [sourceBalance] = (await sql`
    SELECT viewer_id, current_balance, lifetime_earned, lifetime_spent, last_synced_at
    FROM viewer_balances
    WHERE viewer_id = ${sourceViewer.id}
    LIMIT 1
  `) as BalanceRow[];
  const [targetBalance] = (await sql`
    SELECT viewer_id, current_balance, lifetime_earned, lifetime_spent, last_synced_at
    FROM viewer_balances
    WHERE viewer_id = ${targetViewer.id}
    LIMIT 1
  `) as BalanceRow[];
  const [sourceOwnerLink] = (await sql`
    SELECT id, google_account_id, viewer_id
    FROM google_account_viewers
    WHERE viewer_id = ${sourceViewer.id}
    LIMIT 1
  `) as GoogleAccountViewerRow[];
  const [targetOwnerLink] = (await sql`
    SELECT id, google_account_id, viewer_id
    FROM google_account_viewers
    WHERE viewer_id = ${targetViewer.id}
    LIMIT 1
  `) as GoogleAccountViewerRow[];
  const conflictingBetEntries = (await sql`
    SELECT source.bet_id
    FROM bet_entries source
    INNER JOIN bet_entries target
      ON target.bet_id = source.bet_id
     AND target.viewer_id = ${targetViewer.id}
    WHERE source.viewer_id = ${sourceViewer.id}
  `) as Array<{ bet_id: string }>;

  if (
    sourceOwnerLink &&
    targetOwnerLink &&
    sourceOwnerLink.google_account_id !== targetOwnerLink.google_account_id
  ) {
    throw new Error(
      `Cannot merge ${sourceViewer.id} into ${targetViewer.id}: viewers belong to different Google accounts.`,
    );
  }
  if (conflictingBetEntries.length > 0) {
    throw new Error(
      `Cannot auto-merge ${sourceViewer.id} into ${targetViewer.id}: duplicate bet entries found.`,
    );
  }

  const [ledgerCounts, redemptionCounts, betCounts, suggestionCounts, boostCounts, videoSuggestionCounts, videoBoostCounts] =
    await Promise.all([
      sql`
        SELECT COUNT(*)::int AS count
        FROM point_ledger
        WHERE viewer_id = ${sourceViewer.id}
      `,
      sql`
        SELECT COUNT(*)::int AS count
        FROM redemptions
        WHERE viewer_id = ${sourceViewer.id}
      `,
      sql`
        SELECT COUNT(*)::int AS count
        FROM bet_entries
        WHERE viewer_id = ${sourceViewer.id}
      `,
      sql`
        SELECT COUNT(*)::int AS count
        FROM game_suggestions
        WHERE viewer_id = ${sourceViewer.id}
      `,
      sql`
        SELECT COUNT(*)::int AS count
        FROM game_suggestion_boosts
        WHERE viewer_id = ${sourceViewer.id}
      `,
      sql`
        SELECT COUNT(*)::int AS count
        FROM video_suggestions
        WHERE viewer_id = ${sourceViewer.id}
      `,
      sql`
        SELECT COUNT(*)::int AS count
        FROM video_suggestion_boosts
        WHERE viewer_id = ${sourceViewer.id}
      `,
    ]);

  const summary = {
    sourceViewer: {
      ...sourceViewer,
      balance: sourceBalance ?? null,
      googleAccountId: sourceOwnerLink?.google_account_id ?? null,
    },
    targetViewer: {
      ...targetViewer,
      balance: targetBalance ?? null,
      googleAccountId: targetOwnerLink?.google_account_id ?? null,
    },
    transferCounts: {
      ledger: ledgerCounts[0]?.count ?? 0,
      redemptions: redemptionCounts[0]?.count ?? 0,
      betEntries: betCounts[0]?.count ?? 0,
      gameSuggestions: suggestionCounts[0]?.count ?? 0,
      gameSuggestionBoosts: boostCounts[0]?.count ?? 0,
      videoSuggestions: videoSuggestionCounts[0]?.count ?? 0,
      videoSuggestionBoosts: videoBoostCounts[0]?.count ?? 0,
    },
  };

  console.info(JSON.stringify(summary, null, 2));
  if (args.dryRun) {
    console.info("Dry run only. No rows were changed.");
    return;
  }

  await sql.transaction((txn) => {
    const queries = [
      txn`
        UPDATE users
        SET
          google_user_id = COALESCE(users.google_user_id, ${sourceViewer.google_user_id}),
          email = COALESCE(users.email, ${sourceViewer.email}),
          avatar_url = COALESCE(users.avatar_url, ${sourceViewer.avatar_url}),
          is_linked = users.is_linked OR ${sourceViewer.is_linked} OR ${Boolean(sourceOwnerLink)},
          exclude_from_ranking = users.exclude_from_ranking OR ${sourceViewer.exclude_from_ranking}
        WHERE id = ${targetViewer.id}
      `,
      txn`UPDATE point_ledger SET viewer_id = ${targetViewer.id} WHERE viewer_id = ${sourceViewer.id}`,
      txn`UPDATE redemptions SET viewer_id = ${targetViewer.id} WHERE viewer_id = ${sourceViewer.id}`,
      txn`UPDATE bet_entries SET viewer_id = ${targetViewer.id} WHERE viewer_id = ${sourceViewer.id}`,
      txn`UPDATE game_suggestions SET viewer_id = ${targetViewer.id} WHERE viewer_id = ${sourceViewer.id}`,
      txn`UPDATE game_suggestion_boosts SET viewer_id = ${targetViewer.id} WHERE viewer_id = ${sourceViewer.id}`,
      txn`UPDATE video_suggestions SET viewer_id = ${targetViewer.id} WHERE viewer_id = ${sourceViewer.id}`,
      txn`UPDATE video_suggestion_boosts SET viewer_id = ${targetViewer.id} WHERE viewer_id = ${sourceViewer.id}`,
      txn`
        UPDATE google_accounts
        SET active_viewer_id = ${targetViewer.id}
        WHERE active_viewer_id = ${sourceViewer.id}
      `,
    ];

    if (sourceOwnerLink && !targetOwnerLink) {
      queries.push(
        txn`
          UPDATE google_account_viewers
          SET viewer_id = ${targetViewer.id}
          WHERE id = ${sourceOwnerLink.id}
        `,
      );
    } else if (sourceOwnerLink) {
      queries.push(
        txn`DELETE FROM google_account_viewers WHERE viewer_id = ${sourceViewer.id}`,
      );
    }

    if (targetBalance) {
      queries.push(
        txn`
          UPDATE viewer_balances
          SET
            current_balance = ${(targetBalance.current_balance ?? 0) + (sourceBalance?.current_balance ?? 0)},
            lifetime_earned = ${(targetBalance.lifetime_earned ?? 0) + (sourceBalance?.lifetime_earned ?? 0)},
            lifetime_spent = ${(targetBalance.lifetime_spent ?? 0) + (sourceBalance?.lifetime_spent ?? 0)},
            last_synced_at = GREATEST(
              ${targetBalance.last_synced_at}::timestamptz,
              ${sourceBalance?.last_synced_at ?? targetBalance.last_synced_at}::timestamptz
            )
          WHERE viewer_id = ${targetViewer.id}
        `,
      );
    } else if (sourceBalance) {
      queries.push(
        txn`
          INSERT INTO viewer_balances (
            viewer_id,
            current_balance,
            lifetime_earned,
            lifetime_spent,
            last_synced_at
          ) VALUES (
            ${targetViewer.id},
            ${sourceBalance.current_balance},
            ${sourceBalance.lifetime_earned},
            ${sourceBalance.lifetime_spent},
            ${sourceBalance.last_synced_at}::timestamptz
          )
        `,
      );
    }

    queries.push(
      txn`DELETE FROM viewer_balances WHERE viewer_id = ${sourceViewer.id}`,
      txn`DELETE FROM users WHERE id = ${sourceViewer.id}`,
    );

    return queries;
  });

  console.info(`Merged ${sourceViewer.id} into ${targetViewer.id}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
