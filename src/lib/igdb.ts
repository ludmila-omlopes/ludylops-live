import { env } from "@/lib/env";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_GAMES_URL = "https://api.igdb.com/v4/games";
const IGDB_SEARCH_URL = "https://api.igdb.com/v4/search";
const MAX_QUERY_LENGTH = 80;

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

type IgdbSearchHit = {
  game?: number;
};

export type IgdbGameSearchResult = {
  igdbId: number;
  name: string;
  releaseYear: number | null;
  coverImageUrl: string | null;
  platforms: string[];
  genres: string[];
};

let tokenCache: { token: string; expiresAt: number } | null = null;

export function isIgdbConfigured() {
  return Boolean(env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET);
}

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

function normalizeSearchToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function buildSearchQueries(query: string) {
  const normalizedQuery = normalizeQuery(query);
  const tokenized = normalizeSearchToken(normalizedQuery);
  const stopWords = new Set(["a", "an", "the", "of", "o", "os", "a", "as", "de", "do", "da", "dos", "das"]);
  const meaningfulTokens = tokenized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token));
  const queries = [normalizedQuery];

  if (meaningfulTokens.length >= 2) {
    queries.push(meaningfulTokens.slice(-2).join(" "));
  }

  if (meaningfulTokens.length >= 3) {
    queries.push(meaningfulTokens.slice(-3).join(" "));
  }

  const lastToken = meaningfulTokens.at(-1);
  if (lastToken && lastToken.length >= 5) {
    queries.push(lastToken);
  }

  return [...new Set(queries)].filter((entry) => entry.length >= 2);
}

function escapeApicalypseString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildCoverUrl(cover?: IgdbGame["cover"]) {
  if (cover?.image_id) {
    return `https://images.igdb.com/igdb/image/upload/t_cover_big/${cover.image_id}.jpg`;
  }

  if (!cover?.url) {
    return null;
  }

  return cover.url.startsWith("//") ? `https:${cover.url}` : cover.url;
}

function mapIgdbGame(game: IgdbGame): IgdbGameSearchResult | null {
  if (!game.name?.trim()) {
    return null;
  }

  return {
    igdbId: game.id,
    name: game.name.trim(),
    releaseYear: game.first_release_date
      ? new Date(game.first_release_date * 1000).getUTCFullYear()
      : null,
    coverImageUrl: buildCoverUrl(game.cover),
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
  if (!env.IGDB_CLIENT_ID || !env.IGDB_CLIENT_SECRET) {
    throw new Error("igdb_not_configured");
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.token;
  }

  const url = new URL(TWITCH_TOKEN_URL);
  url.searchParams.set("client_id", env.IGDB_CLIENT_ID);
  url.searchParams.set("client_secret", env.IGDB_CLIENT_SECRET);
  url.searchParams.set("grant_type", "client_credentials");

  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    throw new Error("igdb_auth_failed");
  }

  const payload = (await response.json()) as TwitchTokenResponse;
  if (!payload.access_token) {
    throw new Error("igdb_auth_failed");
  }

  tokenCache = {
    token: payload.access_token,
    expiresAt: now + Math.max(payload.expires_in - 60, 60) * 1000,
  };

  return tokenCache.token;
}

async function igdbRequest<TResponse>(url: string, body: string) {
  if (!env.IGDB_CLIENT_ID) {
    throw new Error("igdb_not_configured");
  }

  const token = await getIgdbAccessToken();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Client-ID": env.IGDB_CLIENT_ID,
    },
    body,
  });

  if (!response.ok) {
    throw new Error("igdb_request_failed");
  }

  return (await response.json()) as TResponse;
}

function buildGameFieldsQuery() {
  return "fields name,first_release_date,cover.image_id,cover.url,genres.name,platforms.name;";
}

async function igdbGamesRequest(body: string) {
  return igdbRequest<IgdbGame[]>(IGDB_GAMES_URL, body);
}

async function igdbSearchRequest(body: string) {
  return igdbRequest<IgdbSearchHit[]>(IGDB_SEARCH_URL, body);
}

async function fetchIgdbGamesByIds(ids: number[]) {
  const uniqueIds = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0).slice(0, 8);
  if (uniqueIds.length === 0) {
    return [];
  }

  return igdbGamesRequest(
    [
      buildGameFieldsQuery(),
      `where id = (${uniqueIds.join(",")}) & version_parent = null;`,
      "limit 8;",
    ].join(" "),
  );
}

export async function searchIgdbGames(query: string) {
  const normalizedQuery = normalizeQuery(query);
  if (normalizedQuery.length < 2) {
    return [];
  }

  const results = new Map<number, IgdbGameSearchResult>();
  const searchQueries = buildSearchQueries(normalizedQuery);

  for (const searchQuery of searchQueries) {
    const games = await igdbGamesRequest(
      [
        `search "${escapeApicalypseString(searchQuery)}";`,
        buildGameFieldsQuery(),
        "where version_parent = null;",
        "limit 8;",
      ].join(" "),
    );

    for (const game of games.map(mapIgdbGame).filter((entry): entry is IgdbGameSearchResult => Boolean(entry))) {
      results.set(game.igdbId, game);
    }

    if (results.size > 0) {
      break;
    }
  }

  for (const searchQuery of searchQueries) {
    if (results.size > 0) {
      break;
    }

    const hits = await igdbSearchRequest(
      [
        `search "${escapeApicalypseString(searchQuery)}";`,
        "fields game;",
        "where game != null;",
        "limit 8;",
      ].join(" "),
    );
    const games = await fetchIgdbGamesByIds(
      hits.map((hit) => hit.game).filter((gameId): gameId is number => Boolean(gameId)),
    );

    for (const game of games.map(mapIgdbGame).filter((entry): entry is IgdbGameSearchResult => Boolean(entry))) {
      results.set(game.igdbId, game);
    }
  }

  return [...results.values()].slice(0, 8);
}
