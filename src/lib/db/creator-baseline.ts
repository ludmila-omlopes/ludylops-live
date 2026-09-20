// Immutable data preparation v1, captured from creators/defaults.ts and 0021.
// Future seed changes require a new version; never replay the historical upserts.
export const CREATOR_BASELINE_VERSION = "creator-foundation-v1";
export const baselineSeed = {
  creatorId: "creator_ludylops",
  slug: "ludylops",
  displayName: "Ludylops",
  domainId: "creator_domain_ludylops_live",
  hostname: "ludylops.live",
  branding: ["#c7a2e9", "#ff79c6", "#f9f9f9", "#40a9ff", "app-display", "app-body", 0, "{}"],
  modules: [
    ["points", { currencyLabel: "pipetz" }],
    ["ranking", {}],
    ["redemptions", {}],
    ["bets", { minBet: 10, maxOptions: 6 }],
    ["product_recommendations", {}],
    ["game_suggestions", {}],
    ["video_suggestions", {}],
    ["creator_suggestions", {}],
    ["quotes", { displayDurationSeconds: 12 }],
    ["obs_overlays", {}],
    ["streamerbot", {}],
  ],
} as const;

export interface BaselineConnection {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export class BaselineError extends Error {
  constructor(public readonly code: "schema_missing" | "identity_conflict" | "verification_failed") {
    super(code);
  }
}

export type BaselineReport = {
  version: typeof CREATOR_BASELINE_VERSION;
  ready: boolean;
  creatorExists: boolean;
  missing: string[];
  inserted: number;
};

type Creator = { id: string; slug: string };
type Domain = { id: string; creator_id: string; hostname: string; is_primary: boolean };
type Module = { id: string; creator_id: string; module_key: string };
type State = { creators: Creator[]; domains: Domain[]; branding: { creator_id: string }[]; modules: Module[] };
const seed = baselineSeed;
const moduleId = (key: string) => `creator_module_ludylops_${key}`;
const requiredColumns = {
  creators: ["id", "slug", "display_name", "owner_user_id", "status", "created_at", "updated_at"],
  creator_domains: ["id", "creator_id", "hostname", "is_primary", "created_at"],
  creator_branding: ["creator_id", "logo_url", "avatar_url", "primary_color", "secondary_color", "background_color", "accent_color", "font_heading", "font_body", "border_radius", "theme_json", "updated_at"],
  creator_modules: ["id", "creator_id", "module_key", "status", "config_json", "installed_at", "updated_at"],
};

async function readState(db: BaselineConnection): Promise<State> {
  const creators = await db.query<Creator>(
    "SELECT id, slug FROM public.creators WHERE id = $1 OR slug = $2",
    [seed.creatorId, seed.slug],
  );
  const domains = await db.query<Domain>(
    "SELECT id, creator_id, hostname, is_primary FROM public.creator_domains WHERE creator_id = $1 OR id = $2 OR hostname = $3",
    [seed.creatorId, seed.domainId, seed.hostname],
  );
  const branding = await db.query<{ creator_id: string }>(
    "SELECT creator_id FROM public.creator_branding WHERE creator_id = $1", [seed.creatorId],
  );
  const modules = await db.query<Module>(
    "SELECT id, creator_id, module_key FROM public.creator_modules WHERE creator_id = $1 OR id = ANY($2::varchar[])",
    [seed.creatorId, seed.modules.map(([key]) => moduleId(key))],
  );
  return { creators: creators.rows, domains: domains.rows, branding: branding.rows, modules: modules.rows };
}

function inspect(state: State): BaselineReport {
  if (state.creators.some((row) => row.slug === seed.slug && row.id !== seed.creatorId)
    || state.domains.some((row) =>
      (row.hostname === seed.hostname && row.creator_id !== seed.creatorId)
      || (row.id === seed.domainId && (row.creator_id !== seed.creatorId || row.hostname !== seed.hostname)))
    || seed.modules.some(([key]) => state.modules.some((row) =>
      row.id === moduleId(key) && (row.creator_id !== seed.creatorId || row.module_key !== key)))) {
    throw new BaselineError("identity_conflict");
  }
  const creatorExists = state.creators.some((row) => row.id === seed.creatorId);
  const missing: string[] = [];
  if (!creatorExists) missing.push("creator");
  if (!state.branding.length) missing.push("branding");
  if (!state.domains.some((row) => row.hostname === seed.hostname && row.creator_id === seed.creatorId)) missing.push("domain");
  for (const [key] of seed.modules) {
    if (!state.modules.some((row) => row.creator_id === seed.creatorId && row.module_key === key)) missing.push(`module:${key}`);
  }
  return { version: CREATOR_BASELINE_VERSION, ready: missing.length === 0, creatorExists, missing, inserted: 0 };
}

async function insertMissing(db: BaselineConnection, state: State, missing: string[]) {
  if (missing.includes("creator")) {
    await db.query(
      "INSERT INTO public.creators (id, slug, display_name, owner_user_id, status) VALUES ($1, $2, $3, NULL, 'active')",
      [seed.creatorId, seed.slug, seed.displayName],
    );
  }
  if (missing.includes("branding")) {
    await db.query(
      "INSERT INTO public.creator_branding (creator_id, primary_color, secondary_color, background_color, accent_color, font_heading, font_body, border_radius, theme_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)",
      [seed.creatorId, ...seed.branding],
    );
  }
  if (missing.includes("domain")) {
    await db.query(
      "INSERT INTO public.creator_domains (id, creator_id, hostname, is_primary) VALUES ($1, $2, $3, $4)",
      [seed.domainId, seed.creatorId, seed.hostname, !state.domains.some((row) => row.creator_id === seed.creatorId && row.is_primary)],
    );
  }
  for (const [key, config] of seed.modules) {
    if (missing.includes(`module:${key}`)) {
      await db.query(
        "INSERT INTO public.creator_modules (id, creator_id, module_key, status, config_json) VALUES ($1, $2, $3, 'installed', $4::jsonb)",
        [moduleId(key), seed.creatorId, key, JSON.stringify(config)],
      );
    }
  }
}

/** Caller owns the dedicated connection and must close it even on failure. */
export async function runCreatorBaseline(db: BaselineConnection, apply = false): Promise<BaselineReport> {
  await db.query(apply ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await db.query("SET LOCAL statement_timeout = '15s'");
    await db.query("SET LOCAL lock_timeout = '5s'");
    const schema = await db.query<{ ready: boolean }>(
      "SELECT to_regclass('public.creators') IS NOT NULL AND to_regclass('public.creator_domains') IS NOT NULL AND to_regclass('public.creator_branding') IS NOT NULL AND to_regclass('public.creator_modules') IS NOT NULL AS ready",
    );
    if (schema.rows[0]?.ready !== true) throw new BaselineError("schema_missing");
    const columns = await db.query<{ table_name: string; column_name: string }>(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
      [Object.keys(requiredColumns)],
    );
    if (Object.entries(requiredColumns).some(([table, names]) => names.some((column) =>
      !columns.rows.some((row) => row.table_name === table && row.column_name === column)))) {
      throw new BaselineError("schema_missing");
    }
    if (apply) {
      // Also serializes application writes, protecting primary-domain decisions.
      // Fixed order; held only until this short transaction ends.
      await db.query("LOCK TABLE public.creators, public.creator_domains, public.creator_branding, public.creator_modules IN SHARE ROW EXCLUSIVE MODE");
    }
    const state = await readState(db);
    let report = inspect(state);
    if (apply && !report.ready) {
      await insertMissing(db, state, report.missing);
      const verified = inspect(await readState(db));
      if (!verified.ready) throw new BaselineError("verification_failed");
      report = { ...verified, inserted: report.missing.length };
    }
    await db.query("COMMIT");
    return report;
  } catch (error) {
    // Keep the original failure; a disconnected server may also reject rollback.
    await db.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}
