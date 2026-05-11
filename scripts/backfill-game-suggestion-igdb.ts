import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";

type GameSuggestionRow = {
  id: string;
  name: string;
  igdb_id: number | null;
};

type TwitchTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type IgdbGame = {
  id: number;
  name?: string;
  first_release_date?: number;
  cover?: {
    image_id?: string;
    url?: string;
  };
  genres?: Array<{ name?: string }>;
  platforms?: Array<{ name?: string }>;
};

type GameMetadata = {
  igdbId: number;
  canonicalName: string;
  coverImageUrl: string | null;
  releaseYear: number | null;
  platforms: string[];
  genres: string[];
};

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ENV_FILES = [resolve(ROOT, ".env.local"), resolve(ROOT, ".env")];
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_GAMES_URL = "https://api.igdb.com/v4/games";
const MANUAL_MATCHES: Record<string, { query: string; expectedName: string }> = {
  "pokemon fire red": {
    query: "Pokemon FireRed Version",
    expectedName: "Pokémon FireRed Version",
  },
  "crash 3 warped": {
    query: "Crash Bandicoot: Warped",
    expectedName: "Crash Bandicoot: Warped",
  },
  "twinsens odyssey": {
    query: "Twinsen's Little Big Adventure 2 Classic",
    expectedName: "Twinsen's Little Big Adventure 2 Classic",
  },
  "uncharted 1": {
    query: "Uncharted Drake's Fortune",
    expectedName: "Uncharted: Drake's Fortune",
  },
  deadcells: {
    query: "Dead Cells",
    expectedName: "Dead Cells",
  },
  "megaman x5": {
    query: "Mega Man X5",
    expectedName: "Mega Man X5",
  },
  "the room 3": {
    query: "The Room Three",
    expectedName: "The Room Three",
  },
  "the room 4": {
    query: "The Room Old Sins",
    expectedName: "The Room 4: Old Sins",
  },
};

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
  return {
    apply: process.argv.includes("--apply"),
    includeExisting: process.argv.includes("--include-existing"),
  };
}

function normalizeTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bdlc\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeApicalypseString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function coverUrl(cover?: IgdbGame["cover"]) {
  if (cover?.image_id) {
    return `https://images.igdb.com/igdb/image/upload/t_cover_big/${cover.image_id}.jpg`;
  }

  if (!cover?.url) {
    return null;
  }

  return cover.url.startsWith("//") ? `https:${cover.url}` : cover.url;
}

function mapGame(game: IgdbGame): GameMetadata | null {
  if (!game.name?.trim()) {
    return null;
  }

  return {
    igdbId: game.id,
    canonicalName: game.name.trim(),
    coverImageUrl: coverUrl(game.cover),
    releaseYear: game.first_release_date
      ? new Date(game.first_release_date * 1000).getUTCFullYear()
      : null,
    platforms: (game.platforms ?? [])
      .map((platform) => platform.name?.trim())
      .filter((platform): platform is string => Boolean(platform))
      .slice(0, 4),
    genres: (game.genres ?? [])
      .map((genre) => genre.name?.trim())
      .filter((genre): genre is string => Boolean(genre))
      .slice(0, 3),
  };
}

async function getIgdbAccessToken() {
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing IGDB_CLIENT_ID or IGDB_CLIENT_SECRET.");
  }

  const url = new URL(TWITCH_TOKEN_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    throw new Error(`IGDB auth failed with ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as TwitchTokenResponse;
  return payload.access_token;
}

async function searchIgdbGames(query: string, token: string) {
  const clientId = process.env.IGDB_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing IGDB_CLIENT_ID.");
  }

  const body = [
    `search "${escapeApicalypseString(query)}";`,
    "fields name,first_release_date,cover.image_id,cover.url,genres.name,platforms.name;",
    "where version_parent = null;",
    "limit 10;",
  ].join(" ");

  const response = await fetch(IGDB_GAMES_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Client-ID": clientId,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`IGDB search failed for "${query}" with ${response.status}: ${await response.text()}`);
  }

  const games = (await response.json()) as IgdbGame[];
  return games.map(mapGame).filter((game): game is GameMetadata => Boolean(game));
}

function pickStrongMatch(sourceName: string, candidates: GameMetadata[]) {
  const normalizedSource = normalizeTitle(sourceName);
  const manualMatch = MANUAL_MATCHES[normalizedSource];
  if (manualMatch) {
    const manualCandidate = candidates.find(
      (candidate) => candidate.canonicalName.toLowerCase() === manualMatch.expectedName.toLowerCase(),
    );

    if (manualCandidate) {
      return { status: "matched" as const, game: manualCandidate, reason: "manual-verified-alias" };
    }

    return {
      status: "ambiguous" as const,
      reason: `manual alias did not find expected IGDB title "${manualMatch.expectedName}"`,
    };
  }

  const exactMatches = candidates.filter((candidate) => normalizeTitle(candidate.canonicalName) === normalizedSource);

  if (exactMatches.length === 1) {
    return { status: "matched" as const, game: exactMatches[0], reason: "exact-normalized-name" };
  }

  if (exactMatches.length > 1) {
    return {
      status: "ambiguous" as const,
      reason: `multiple exact matches: ${exactMatches.map((game) => game.canonicalName).join(", ")}`,
    };
  }

  return {
    status: candidates.length === 0 ? "not-found" as const : "ambiguous" as const,
    reason: candidates.length === 0
      ? "no IGDB results"
      : `no exact match; top results: ${candidates.slice(0, 4).map((game) => game.canonicalName).join(", ")}`,
  };
}

async function main() {
  loadLocalEnv();
  const { apply, includeExisting } = parseArgs();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL.");
  }

  const sql = neon(databaseUrl);
  const token = await getIgdbAccessToken();
  const rows = (await sql`
    SELECT id, name, igdb_id
    FROM game_suggestions
    WHERE ${includeExisting} OR igdb_id IS NULL
    ORDER BY created_at ASC
  `) as GameSuggestionRow[];

  console.info(`${apply ? "Apply" : "Dry-run"} mode. Inspecting ${rows.length} suggestions.`);

  let matched = 0;
  let updated = 0;
  let skipped = 0;
  let ambiguous = 0;
  let notFound = 0;

  for (const row of rows) {
    if (row.igdb_id && !includeExisting) {
      skipped += 1;
      continue;
    }

    const manualMatch = MANUAL_MATCHES[normalizeTitle(row.name)];
    const candidates = await searchIgdbGames(manualMatch?.query ?? row.name, token);
    const match = pickStrongMatch(row.name, candidates);

    if (match.status !== "matched") {
      if (match.status === "not-found") {
        notFound += 1;
      } else {
        ambiguous += 1;
      }
      console.warn(`[${match.status}] ${row.name}: ${match.reason}`);
      continue;
    }

    matched += 1;
    const game = match.game;
    console.info(
      `${apply ? "[update]" : "[dry-run]"} ${row.name} -> ${game.canonicalName} (${game.igdbId})`,
    );

    if (!apply) {
      continue;
    }

    await sql`
      UPDATE game_suggestions
      SET
        igdb_id = ${game.igdbId},
        canonical_name = ${game.canonicalName},
        cover_image_url = ${game.coverImageUrl},
        release_year = ${game.releaseYear},
        platforms = ${JSON.stringify(game.platforms)}::jsonb,
        genres = ${JSON.stringify(game.genres)}::jsonb,
        updated_at = now()
      WHERE id = ${row.id}
    `;
    updated += 1;
  }

  console.info(
    [
      apply ? "Backfill complete." : "Dry-run complete.",
      `matched=${matched}`,
      `updated=${updated}`,
      `skipped=${skipped}`,
      `ambiguous=${ambiguous}`,
      `notFound=${notFound}`,
    ].join(" "),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
