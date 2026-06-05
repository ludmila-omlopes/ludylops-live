export const STEAM_DEFAULT_COUNTRY_CODE = "BR";
export const STEAM_DEFAULT_LANGUAGE = "brazilian";

const STEAM_STORE_BASE_URL = "https://store.steampowered.com";
const STEAM_APPDETAILS_URL = `${STEAM_STORE_BASE_URL}/api/appdetails`;
const STEAM_SEARCH_URL = `${STEAM_STORE_BASE_URL}/api/storesearch`;
const REQUEST_TIMEOUT_MS = 20_000;

export type SteamPriceResolution = {
  match: SteamGameMatch | null;
  checkedAt: Date;
};

export type SteamGameMatch = {
  appId: number;
  name: string;
  storeUrl: string;
  currency: string | null;
  initialPriceCents: number | null;
  finalPriceCents: number | null;
  discountPercent: number | null;
  isFree: boolean;
  matchConfidence: "app_id" | "exact_name";
};

export type SteamGameCandidate = {
  name: string;
  canonicalName?: string | null;
  linkUrl?: string | null;
  steamAppId?: number | null;
  steamStoreUrl?: string | null;
};

type SteamPriceOverview = {
  currency?: unknown;
  initial?: unknown;
  final?: unknown;
  discount_percent?: unknown;
};

type SteamAppDetailsPayload = {
  success?: unknown;
  data?: {
    name?: unknown;
    type?: unknown;
    is_free?: unknown;
    price_overview?: SteamPriceOverview;
  };
};

type SteamSearchPayload = {
  items?: Array<{
    id?: unknown;
    name?: unknown;
  }>;
};

function normalizeSteamCountryCode(value?: string | null) {
  const normalized = value?.trim().toUpperCase();
  return normalized || STEAM_DEFAULT_COUNTRY_CODE;
}

function normalizeSteamLanguage(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized || STEAM_DEFAULT_LANGUAGE;
}

export function normalizeSteamGameName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2122\u00ae\u00a9]/g, "")
    .replace(/\b(?:game of the year|goty|standard|deluxe|ultimate|complete|definitive|collector'?s?)\s+edition\b/gi, " ")
    .replace(/\b(?:complete|deluxe|ultimate|collector'?s?)\s+pack\b/gi, " ")
    .replace(/\b(?:edition|bundle|pack)\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function parseSteamAppId(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const directAppId = Number.parseInt(trimmed, 10);
  if (Number.isInteger(directAppId) && directAppId > 0 && String(directAppId) === trimmed) {
    return directAppId;
  }

  const match = trimmed.match(/store\.steampowered\.com\/app\/(\d+)/i) ?? trimmed.match(/\/app\/(\d+)/i);
  if (!match?.[1]) {
    return null;
  }

  const appId = Number.parseInt(match[1], 10);
  return Number.isInteger(appId) && appId > 0 ? appId : null;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNullableInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function buildSteamStoreUrl(appId: number) {
  return `${STEAM_STORE_BASE_URL}/app/${appId}`;
}

async function fetchJson<TResponse>(url: URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
        "user-agent": "ludylops-live/steam-price-sync",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`steam_http_${response.status}`);
    }

    return (await response.json()) as TResponse;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSteamAppDetails(
  appId: number,
  {
    countryCode,
    language,
  }: {
    countryCode: string;
    language: string;
  },
) {
  const url = new URL(STEAM_APPDETAILS_URL);
  url.searchParams.set("appids", String(appId));
  url.searchParams.set("cc", countryCode);
  url.searchParams.set("l", language);
  url.searchParams.set("filters", "basic,price_overview");

  const payload = await fetchJson<Record<string, SteamAppDetailsPayload>>(url);
  return payload[String(appId)] ?? null;
}

async function searchSteamStore(
  query: string,
  {
    countryCode,
    language,
  }: {
    countryCode: string;
    language: string;
  },
) {
  const url = new URL(STEAM_SEARCH_URL);
  url.searchParams.set("term", query);
  url.searchParams.set("cc", countryCode);
  url.searchParams.set("l", language);
  url.searchParams.set("category1", "998");

  const payload = await fetchJson<SteamSearchPayload>(url);
  return Array.isArray(payload.items) ? payload.items : [];
}

function buildSteamMatch(
  appId: number,
  payload: SteamAppDetailsPayload,
  matchConfidence: SteamGameMatch["matchConfidence"],
) {
  if (payload.success !== true || !payload.data) {
    return null;
  }

  const name = asNullableString(payload.data.name);
  if (!name) {
    return null;
  }

  const price = payload.data.price_overview;
  const isFree = payload.data.is_free === true;

  return {
    appId,
    name,
    storeUrl: buildSteamStoreUrl(appId),
    currency: asNullableString(price?.currency),
    initialPriceCents: asNullableInteger(price?.initial),
    finalPriceCents: asNullableInteger(price?.final),
    discountPercent: asNullableInteger(price?.discount_percent),
    isFree,
    matchConfidence,
  } satisfies SteamGameMatch;
}

function getCandidateNames(candidate: SteamGameCandidate) {
  return [candidate.canonicalName, candidate.name]
    .filter((entry): entry is string => Boolean(entry?.trim()))
    .map((entry) => entry.trim());
}

async function findExactSteamSearchMatch(
  candidate: SteamGameCandidate,
  {
    countryCode,
    language,
  }: {
    countryCode: string;
    language: string;
  },
) {
  const candidateNames = getCandidateNames(candidate);
  const normalizedCandidateNames = new Set(candidateNames.map(normalizeSteamGameName).filter(Boolean));

  for (const name of candidateNames) {
    const items = await searchSteamStore(name, { countryCode, language });
    const exactMatch = items.find((item) => {
      const itemName = asNullableString(item.name);
      return itemName ? normalizedCandidateNames.has(normalizeSteamGameName(itemName)) : false;
    });

    const appId = asNullableInteger(exactMatch?.id);
    if (appId) {
      return appId;
    }
  }

  return null;
}

export async function resolveSteamGamePrice(
  candidate: SteamGameCandidate,
  {
    countryCode: rawCountryCode,
    language: rawLanguage,
  }: {
    countryCode?: string | null;
    language?: string | null;
  } = {},
): Promise<SteamPriceResolution> {
  const checkedAt = new Date();
  const countryCode = normalizeSteamCountryCode(rawCountryCode);
  const language = normalizeSteamLanguage(rawLanguage);
  const directAppId =
    candidate.steamAppId ??
    parseSteamAppId(candidate.steamStoreUrl) ??
    parseSteamAppId(candidate.linkUrl);

  if (directAppId) {
    const payload = await fetchSteamAppDetails(directAppId, { countryCode, language });
    return {
      checkedAt,
      match: payload ? buildSteamMatch(directAppId, payload, "app_id") : null,
    };
  }

  const matchedAppId = await findExactSteamSearchMatch(candidate, { countryCode, language });
  if (!matchedAppId) {
    return { checkedAt, match: null };
  }

  const payload = await fetchSteamAppDetails(matchedAppId, { countryCode, language });
  return {
    checkedAt,
    match: payload ? buildSteamMatch(matchedAppId, payload, "exact_name") : null,
  };
}
