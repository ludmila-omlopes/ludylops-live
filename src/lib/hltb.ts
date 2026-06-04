export interface EnrichedCompletionTimes {
  hltbId: string;
  title: string;
  mainStoryMinutes: number | null;
  mainExtraMinutes: number | null;
  completionistMinutes: number | null;
  storeUrl: string;
  score: number;
  rawData: HltbSearchEntry;
}

export interface CatalogCompletionTimeAdapter {
  searchBestMatch(input: {
    title: string;
    platformName?: string | null;
  }): Promise<EnrichedCompletionTimes | null>;
}

type HltbAuth = {
  token?: string;
  hpKey?: string;
  hpVal?: string;
};

type HltbSearchResponse = {
  data?: HltbSearchEntry[];
};

export type HltbSearchEntry = {
  game_id?: number | string;
  game_name?: string;
  game_alias?: string | string[] | null;
  profile_platform?: string | string[] | null;
  comp_main?: number;
  comp_plus?: number;
  comp_100?: number;
  [key: string]: unknown;
};

const HLTB_BASE_URL = "https://howlongtobeat.com";
const HLTB_FALLBACK_SEARCH_PATH = "/api/s";
const HLTB_MIN_SCORE = 55;
const HLTB_REQUEST_TIMEOUT_MS = 8_000;
const HLTB_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

let searchPathPromise: Promise<string> | null = null;

function buildHeaders(auth?: HltbAuth) {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
    "content-type": "application/json",
    origin: HLTB_BASE_URL,
    referer: `${HLTB_BASE_URL}/`,
    "user-agent": HLTB_USER_AGENT,
    ...(auth?.token ? { "x-auth-token": auth.token } : {}),
    ...(auth?.hpKey ? { "x-hp-key": auth.hpKey } : {}),
    ...(auth?.hpVal ? { "x-hp-val": auth.hpVal } : {}),
  };
}

function normalizeTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(game of the year|goty|complete|definitive|ultimate|deluxe|edition|remaster(?:ed)?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value: string) {
  const normalized = normalizeTitle(value);
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

function secondsToMinutes(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value / 60)
    : null;
}

function getEntryAliases(entry: HltbSearchEntry) {
  if (Array.isArray(entry.game_alias)) {
    return entry.game_alias.filter((value): value is string => typeof value === "string");
  }

  return typeof entry.game_alias === "string" && entry.game_alias.trim()
    ? entry.game_alias.split(/[,|]/).map((value) => value.trim()).filter(Boolean)
    : [];
}

function getEntryPlatforms(entry: HltbSearchEntry) {
  if (Array.isArray(entry.profile_platform)) {
    return entry.profile_platform.filter((value): value is string => typeof value === "string");
  }

  return typeof entry.profile_platform === "string" && entry.profile_platform.trim()
    ? entry.profile_platform.split(/[,|]/).map((value) => value.trim()).filter(Boolean)
    : [];
}

function scoreTitle(candidateTitle: string, queryTitle: string) {
  const candidate = normalizeTitle(candidateTitle);
  const query = normalizeTitle(queryTitle);

  if (!candidate || !query) {
    return 0;
  }

  if (candidate === query) {
    return 100;
  }

  const candidateTokens = new Set(tokenize(candidate));
  const queryTokens = tokenize(query);
  if (candidateTokens.size === 0 || queryTokens.length === 0) {
    return 0;
  }

  const matchingTokens = queryTokens.filter((token) => candidateTokens.has(token)).length;
  const tokenOverlap = (matchingTokens / queryTokens.length) * 75;
  const containsBonus = candidate.includes(query) || query.includes(candidate) ? 20 : 0;
  const lengthPenalty = Math.min(Math.abs(candidate.length - query.length), 20);

  return Math.max(0, Math.min(100, Math.round(tokenOverlap + containsBonus - lengthPenalty)));
}

function scoreCandidate(entry: HltbSearchEntry, input: { title: string; platformName?: string | null }) {
  const titleScores = [entry.game_name, ...getEntryAliases(entry)]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((title) => scoreTitle(title, input.title));

  const titleScore = titleScores.length > 0 ? Math.max(...titleScores) : 0;
  if (titleScore === 0) {
    return 0;
  }

  const platform = input.platformName ? normalizeTitle(input.platformName) : "";
  const platformBonus = platform
    ? getEntryPlatforms(entry).some((candidatePlatform) => normalizeTitle(candidatePlatform).includes(platform))
      ? 10
      : 0
    : 0;

  return Math.min(100, titleScore + platformBonus);
}

function buildSearchPayload(title: string, auth: HltbAuth) {
  const payload: Record<string, unknown> = {
    searchType: "games",
    searchTerms: tokenize(title),
    searchPage: 1,
    size: 20,
    searchOptions: {
      games: {
        userId: 0,
        platform: "",
        sortCategory: "popular",
        rangeCategory: "main",
        rangeTime: { min: 0, max: 0 },
        gameplay: { perspective: "", flow: "", genre: "", difficulty: "" },
        rangeYear: { min: 0, max: 0 },
        modifier: "hide_dlc",
      },
      users: { sortCategory: "postcount" },
      lists: { sortCategory: "follows" },
      filter: "",
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
  };

  if (auth.hpKey) {
    payload[auth.hpKey] = auth.hpVal ?? "";
  }

  return payload;
}

function extractScriptUrls(html: string) {
  return [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map((match) => {
      try {
        return new URL(match[1], HLTB_BASE_URL).toString();
      } catch {
        return null;
      }
    })
    .filter((url): url is string => Boolean(url))
    .sort((left, right) => {
      const leftPriority = left.includes("_app-") ? 1 : 0;
      const rightPriority = right.includes("_app-") ? 1 : 0;
      return rightPriority - leftPriority;
    });
}

function normalizeSearchPath(path: string) {
  return path.replace(/\/init$/, "");
}

function findSearchPathInScript(script: string) {
  const paths = [...script.matchAll(/["'](\/api\/[a-zA-Z0-9_/-]+)["']/g)]
    .map((match) => normalizeSearchPath(match[1]))
    .filter((path) => !path.startsWith("/api/admin/"))
    .filter((path) => !["/api/error", "/api/user", "/api/logout"].includes(path));

  const uniquePaths = [...new Set(paths)];
  const searchHintsPresent = script.includes("searchTerms") || script.includes("searchType") || script.includes("games");

  return uniquePaths.find((path) => searchHintsPresent && script.includes(`${path}/init`))
    ?? uniquePaths.find((path) => searchHintsPresent && path.split("/").length <= 3)
    ?? null;
}

async function fetchText(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    headers: buildHeaders(),
    signal,
  });

  if (!response.ok) {
    throw new Error(`hltb_text_request_failed:${response.status}`);
  }

  return response.text();
}

async function fetchJson<T>(url: string, init: RequestInit) {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`hltb_json_request_failed:${response.status}`);
  }

  return (await response.json()) as T;
}

async function discoverSearchPath(signal: AbortSignal) {
  if (!searchPathPromise) {
    searchPathPromise = (async () => {
      const html = await fetchText(HLTB_BASE_URL, signal);
      const scripts = extractScriptUrls(html);

      for (const scriptUrl of scripts) {
        try {
          const script = await fetchText(scriptUrl, signal);
          const path = findSearchPathInScript(script);
          if (path) {
            return path;
          }
        } catch {
          // Script discovery is best-effort; keep scanning the other bundles.
        }
      }

      return HLTB_FALLBACK_SEARCH_PATH;
    })().catch(() => HLTB_FALLBACK_SEARCH_PATH);
  }

  return searchPathPromise;
}

async function fetchAuth(searchPath: string, signal: AbortSignal) {
  return fetchJson<HltbAuth>(`${HLTB_BASE_URL}${searchPath}/init?t=${Date.now()}`, {
    headers: buildHeaders(),
    signal,
  });
}

async function searchHltb(input: { title: string; platformName?: string | null }, signal: AbortSignal) {
  const searchPath = await discoverSearchPath(signal);
  const auth = await fetchAuth(searchPath, signal);

  return fetchJson<HltbSearchResponse>(`${HLTB_BASE_URL}${searchPath}`, {
    method: "POST",
    headers: buildHeaders(auth),
    body: JSON.stringify(buildSearchPayload(input.title, auth)),
    signal,
  });
}

function mapHltbEntry(entry: HltbSearchEntry, score: number): EnrichedCompletionTimes | null {
  const hltbId = String(entry.game_id ?? "").trim();
  const title = entry.game_name?.trim();
  const mainStoryMinutes = secondsToMinutes(entry.comp_main);
  const mainExtraMinutes = secondsToMinutes(entry.comp_plus);
  const completionistMinutes = secondsToMinutes(entry.comp_100);

  if (!hltbId || !title || (mainStoryMinutes === null && mainExtraMinutes === null && completionistMinutes === null)) {
    return null;
  }

  return {
    hltbId,
    title,
    mainStoryMinutes,
    mainExtraMinutes,
    completionistMinutes,
    storeUrl: `${HLTB_BASE_URL}/game/${hltbId}`,
    score,
    rawData: entry,
  };
}

async function searchBestMatch(input: { title: string; platformName?: string | null }) {
  const title = input.title.trim();
  if (title.length < 2) {
    return null;
  }

  try {
    const signal = AbortSignal.timeout(HLTB_REQUEST_TIMEOUT_MS);
    const response = await searchHltb({ ...input, title }, signal);
    const candidates = (response.data ?? [])
      .map((entry) => ({
        entry,
        score: scoreCandidate(entry, input),
      }))
      .sort((left, right) => right.score - left.score);

    const best = candidates.find((candidate) => candidate.score >= HLTB_MIN_SCORE);
    return best ? mapHltbEntry(best.entry, best.score) : null;
  } catch {
    return null;
  }
}

export const hltbAdapter: CatalogCompletionTimeAdapter = {
  searchBestMatch,
};
