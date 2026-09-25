import { getTableColumns, getTableName } from "drizzle-orm";
import * as schema from "../db/schema";
import type { BaselineConnection } from "../db/creator-baseline";
import { decryptCredentialSecret, encryptCredentialSecret } from "../streamerbot/credential-crypto";
import { DEFAULT_CREATOR_ID } from "./defaults";
import { getModuleAvailability } from "./modules";
import { getChatRewardSettings } from "./chat-rewards";

export type PilotEnvironment = {
  economyEnabled?: string;
  encryptionKey?: string;
};
type Check = { code: string; passed: boolean };
type CommunityReport = { slug: string; checks: Check[]; recentHeartbeat: boolean };
export type PilotReport = {
  checkedAt: string;
  scope: "database-and-current-process";
  configurationReady: boolean;
  pilotApproved: false;
  checks: Check[];
  communities: CommunityReport[];
  missingColumns: string[];
};

// Presence checks only: migration constraints/indexes are verified by the migration procedure.
const tables = [schema.users, schema.creators, schema.creatorDomains, schema.creatorBranding,
  schema.creatorModules, schema.streamerbotCredentials, schema.creatorBalances,
  schema.creatorLedger, schema.economyViewerRedirects, schema.creatorCatalogItems,
  schema.creatorRedemptions, schema.creatorBridgeStatus, schema.creatorRedemptionResolutions];

export function validPilotSlugs(slugs: string[]) {
  return slugs.length === 2 && slugs[0] !== slugs[1]
    && slugs.every(s => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 64);
}

/** Dedicated connection required. Never loads env, writes, authenticates or emits raw records. */
export async function runPilotPreflight(db: BaselineConnection, slugs: string[], environment: PilotEnvironment): Promise<PilotReport> {
  if (!validPilotSlugs(slugs)) throw new Error("invalid_pilot_slugs");
  let keyAvailable = false;
  try {
    encryptCredentialSecret("local-key-check", "preflight", "preflight", environment.encryptionKey);
    keyAvailable = true;
  } catch { /* Report only, never print a key or crypto exception. */ }
  const report: PilotReport = {
    checkedAt: new Date().toISOString(), scope: "database-and-current-process",
    configurationReady: false, pilotApproved: false, communities: [], missingColumns: [],
    checks: [
      { code: "economy_enabled_in_process", passed: environment.economyEnabled === "true" },
      { code: "encryption_key_in_process", passed: keyAvailable },
    ],
  };
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await db.query("SET LOCAL statement_timeout = '15s'");
    await db.query("SET LOCAL lock_timeout = '5s'");
    const columns = await db.query<{ table_name: string; column_name: string }>(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
      [tables.map(getTableName)],
    );
    const present = new Set(columns.rows.map(r => `${r.table_name}.${r.column_name}`));
    report.missingColumns = tables.flatMap(t => Object.values(getTableColumns(t))
      .map(c => `${getTableName(t)}.${c.name}`).filter(name => !present.has(name)));
    report.checks.push({ code: "required_columns_present", passed: report.missingColumns.length === 0 });
    if (!report.missingColumns.length) {
      const owners: string[] = [];
      for (const slug of slugs) {
        const community: CommunityReport = { slug, checks: [], recentHeartbeat: false };
        report.communities.push(community);
        const check = (code: string, passed: boolean) => community.checks.push({ code, passed });
        const { rows: [creator] } = await db.query<{ id: string; status: string; owner_account: string | null }>(
          "SELECT c.id, c.status, u.google_user_id AS owner_account FROM public.creators c LEFT JOIN public.users u ON u.id = c.owner_user_id WHERE c.slug = $1", [slug],
        );
        check("nonlegacy_community_exists", Boolean(creator && creator.id !== DEFAULT_CREATOR_ID));
        if (!creator || creator.id === DEFAULT_CREATOR_ID) continue;
        check("community_active", creator.status === "active");
        check("owner_has_login", Boolean(creator.owner_account));
        if (creator.owner_account) owners.push(creator.owner_account);
        const { rows: modules } = await db.query<{ moduleKey: string; status: string; configJson: Record<string, unknown> }>(
          'SELECT module_key AS "moduleKey", status, config_json AS "configJson" FROM public.creator_modules WHERE creator_id = $1', [creator.id],
        );
        for (const key of ["points", "streamerbot", "ranking", "redemptions"]) {
          check(`module_${key}`, getModuleAvailability(modules, key).available);
        }
        check("chat_rewards_enabled", getChatRewardSettings(modules.find(m => m.moduleKey === "points")?.configJson).enabled);
        const { rows: credentials } = await db.query<{ id: string; encrypted_secret: string }>(
          "SELECT id, encrypted_secret FROM public.streamerbot_credentials WHERE creator_id = $1 AND status = 'active' AND revoked_at IS NULL LIMIT 2", [creator.id],
        );
        check("one_active_credential", credentials.length === 1);
        let decryptable = false;
        if (keyAvailable && credentials.length === 1) {
          try {
            decryptable = Boolean(decryptCredentialSecret(credentials[0].encrypted_secret, credentials[0].id, creator.id, environment.encryptionKey));
          } catch { /* Wrong keys and damaged ciphertext are reported without their contents. */ }
        }
        check("active_credential_decryptable", decryptable);
        const { rows: [catalog] } = await db.query<{ available: boolean }>(
          "SELECT EXISTS (SELECT 1 FROM public.creator_catalog_items WHERE creator_id = $1 AND is_active AND (stock IS NULL OR stock > 0) AND cost > 0 AND length(trim(streamerbot_action_ref)) > 0) AS available", [creator.id],
        );
        check("catalog_item_available", catalog?.available === true);
        const { rows: [bridge] } = await db.query<{ recent: boolean }>(
          "SELECT EXISTS (SELECT 1 FROM public.creator_bridge_status WHERE creator_id = $1 AND last_heartbeat_at BETWEEN now() - interval '90 seconds' AND now()) AS recent", [creator.id],
        );
        community.recentHeartbeat = bridge?.recent === true;
      }
      report.checks.push({ code: "two_distinct_owner_accounts", passed: owners.length === 2 && new Set(owners).size === 2 });
    }
    report.configurationReady = report.checks.every(c => c.passed)
      && report.communities.length === 2 && report.communities.every(c => c.checks.every(v => v.passed));
    await db.query("COMMIT");
    return report;
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}
