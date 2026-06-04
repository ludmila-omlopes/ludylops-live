export const PS_PLUS_DELUXE_REGION = "pt-br";
export const PS_PLUS_DELUXE_TIER = "deluxe";
export const PS_PLUS_GAME_CATALOG_CATEGORY_ID = "3a7006fe-e26f-49fe-87e5-4473d7ed0fb2";

const STORE_BASE_URL = "https://store.playstation.com";
const DEFAULT_MAX_PAGES = 30;
const REQUEST_TIMEOUT_MS = 20_000;

export type PsPlusCatalogItem = {
  productId: string;
  titleId: string | null;
  name: string;
  normalizedName: string;
  productUrl: string;
  platforms: string[];
  region: string;
  tier: string;
};

export type PsPlusGameCandidate = {
  name: string;
  canonicalName?: string | null;
  platforms?: string[] | null;
  psPlusProductId?: string | null;
  psPlusTitleId?: string | null;
};

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, " ");
}

export function normalizePsPlusGameName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(?:[\u2122\u00ae\u00a9]|\u00e2\u20ac\u017e\u00a2|\u00c2[\u00ae\u00a9])/g, "")
    .replace(/\[[^\]]*(?:ps4|ps5|playstation)[^\]]*\]/gi, " ")
    .replace(/\([^)]*(?:ps4|ps5|playstation)[^)]*\)/gi, " ")
    .replace(/\b(?:ps4|ps5|ps4 e ps5|ps4 & ps5|playstation 4|playstation 5)\b/gi, " ")
    .replace(/\b(?:standard edition|digital deluxe edition|deluxe edition|ultimate edition)\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function extractPlatforms(tileHtml: string) {
  const text = stripTags(decodeHtmlAttribute(tileHtml));
  const platforms = new Set<string>();
  if (/\bPS5\b/.test(text)) {
    platforms.add("PS5");
  }
  if (/\bPS4\b/.test(text)) {
    platforms.add("PS4");
  }
  return [...platforms];
}

function extractPageCount(html: string, region: string) {
  const escapedCategoryId = PS_PLUS_GAME_CATALOG_CATEGORY_ID.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pagePattern = new RegExp(
    `href="/${region}/category/${escapedCategoryId}/(\\d+)"`,
    "g",
  );
  const pages = [...html.matchAll(pagePattern)]
    .map((match) => Number.parseInt(match[1] ?? "", 10))
    .filter(Number.isFinite);

  return Math.max(1, ...pages);
}

export function parsePsPlusCatalogHtml(html: string, region = PS_PLUS_DELUXE_REGION) {
  const tilePattern =
    /<div data-qa="ems-sdk-grid#productTile\d+" data-qa-index="\d+">([\s\S]*?)(?=<div data-qa="ems-sdk-grid#productTile\d+" data-qa-index="\d+">|<\/ul>|<nav)/g;
  const items = new Map<string, PsPlusCatalogItem>();

  for (const match of html.matchAll(tilePattern)) {
    const tileHtml = match[1] ?? "";
    const metaMatch = tileHtml.match(/data-telemetry-meta="([^"]+)"/);
    if (!metaMatch) {
      continue;
    }

    try {
      const meta = JSON.parse(decodeHtmlAttribute(metaMatch[1] ?? "")) as {
        id?: unknown;
        titleId?: unknown;
        name?: unknown;
      };
      const productId = typeof meta.id === "string" ? meta.id.trim() : "";
      const name = typeof meta.name === "string" ? meta.name.trim() : "";
      if (!productId || !name || items.has(productId)) {
        continue;
      }

      const hrefMatch = tileHtml.match(/href="([^"]*\/product\/[^"]+)"/);
      const href = hrefMatch ? decodeHtmlAttribute(hrefMatch[1] ?? "") : `/${region}/product/${productId}`;
      const productUrl = href.startsWith("http") ? href : `${STORE_BASE_URL}${href}`;

      items.set(productId, {
        productId,
        titleId: typeof meta.titleId === "string" && meta.titleId.trim() ? meta.titleId.trim() : null,
        name,
        normalizedName: normalizePsPlusGameName(name),
        productUrl,
        platforms: extractPlatforms(tileHtml),
        region,
        tier: PS_PLUS_DELUXE_TIER,
      });
    } catch {
      continue;
    }
  }

  return [...items.values()];
}

async function fetchCatalogPage(region: string, page: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${STORE_BASE_URL}/${region}/category/${PS_PLUS_GAME_CATALOG_CATEGORY_ID}/${page}`,
      {
        headers: {
          "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
          "user-agent": "ludylops-live/ps-plus-catalog-sync",
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`playstation_store_http_${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPsPlusDeluxeCatalog({
  region = PS_PLUS_DELUXE_REGION,
  maxPages = DEFAULT_MAX_PAGES,
}: {
  region?: string;
  maxPages?: number;
} = {}) {
  const firstPageHtml = await fetchCatalogPage(region, 1);
  const discoveredPageCount = extractPageCount(firstPageHtml, region);
  const pageLimit = discoveredPageCount > 1 ? Math.min(discoveredPageCount, maxPages) : maxPages;
  const items = new Map<string, PsPlusCatalogItem>();

  for (const item of parsePsPlusCatalogHtml(firstPageHtml, region)) {
    items.set(item.productId, item);
  }

  for (let page = 2; page <= pageLimit; page += 1) {
    const html = await fetchCatalogPage(region, page);
    const pageItems = parsePsPlusCatalogHtml(html, region);
    if (pageItems.length === 0) {
      break;
    }

    for (const item of pageItems) {
      items.set(item.productId, item);
    }
  }

  return {
    region,
    tier: PS_PLUS_DELUXE_TIER,
    itemCount: items.size,
    items: [...items.values()],
  };
}

function hasPlayStationPlatformOverlap(candidatePlatforms: string[], catalogPlatforms: string[]) {
  if (candidatePlatforms.length === 0 || catalogPlatforms.length === 0) {
    return true;
  }

  const normalizedCandidate = candidatePlatforms.map((entry) => entry.toLowerCase());
  return catalogPlatforms.some((platform) => {
    const normalized = platform.toLowerCase();
    return normalizedCandidate.some(
      (candidate) =>
        candidate === normalized ||
        (normalized === "ps4" && candidate.includes("playstation 4")) ||
        (normalized === "ps5" && candidate.includes("playstation 5")),
    );
  });
}

export function findBestPsPlusCatalogMatch(
  candidate: PsPlusGameCandidate,
  catalog: PsPlusCatalogItem[],
) {
  const byProductId = candidate.psPlusProductId
    ? catalog.find((item) => item.productId === candidate.psPlusProductId)
    : null;
  if (byProductId) {
    return byProductId;
  }

  const byTitleId = candidate.psPlusTitleId
    ? catalog.find((item) => item.titleId === candidate.psPlusTitleId)
    : null;
  if (byTitleId) {
    return byTitleId;
  }

  const candidateNames = [candidate.canonicalName, candidate.name]
    .filter((entry): entry is string => Boolean(entry?.trim()))
    .map(normalizePsPlusGameName)
    .filter(Boolean);
  const candidateNameSet = new Set(candidateNames);
  const candidatePlatforms = candidate.platforms ?? [];

  return (
    catalog.find(
      (item) =>
        candidateNameSet.has(item.normalizedName) &&
        hasPlayStationPlatformOverlap(candidatePlatforms, item.platforms),
    ) ?? null
  );
}
