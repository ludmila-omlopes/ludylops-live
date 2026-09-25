const stores = new Set([
  "amazon.com.br", "www.amazon.com.br", "amazon.com", "www.amazon.com", "amzn.to",
  "mercadolivre.com.br", "www.mercadolivre.com.br", "produto.mercadolivre.com.br",
  "kabum.com.br", "www.kabum.com.br", "magazineluiza.com.br", "www.magazineluiza.com.br",
]);

export class RecommendationImageError extends Error {
  constructor(public code: "unsupported" | "unavailable" | "no_image" | "rate_limit" | "invalid") { super(code); }
}

/** Exact store hosts only. Every redirect must pass the same policy. */
export function recommendationProductUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new RecommendationImageError("unsupported"); }
  if (value.length > 2000 || url.protocol !== "https:" || url.port || url.username || url.password || !stores.has(url.hostname))
    throw new RecommendationImageError("unsupported");
  url.hash = "";
  return url;
}

function decode(value: string) {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (full, entity: string) => {
    if (entity[0] !== "#") return named[entity.toLowerCase()] ?? full;
    const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "";
  });
}

function attributes(tag: string) {
  const result: Record<string, string> = Object.create(null);
  for (const match of tag.matchAll(/\s([a-zA-Z_:][\w:.-]{0,63})\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    const key = match[1].toLowerCase();
    if (!(key in result)) result[key] = decode(match[2] ?? match[3] ?? match[4]);
  }
  return result;
}

function imageUrl(value: string, base: URL) {
  try {
    const url = new URL(value.trim(), base);
    const cdns = ["media-amazon.com", "ssl-images-amazon.com", "mlstatic.com", "kabum.com.br", "magazineluiza.com.br", "magazineluiza.com"];
    if (!value.trim() || url.href.length > 2000 || url.protocol !== "https:" || url.port || url.username || url.password) return null;
    if (!stores.has(url.hostname) && !cdns.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}

/** Metadata only; scripts, comments and arbitrary images cannot supply a candidate. */
export function extractRecommendationImage(html: string, base: URL): string | null {
  const clean = html.replace(/<!--[\s\S]*?(?:-->|$)/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "");
  const candidates: { priority: number; value: string }[] = [];
  for (const match of clean.matchAll(/<(?:meta|img)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    if (match[0].length > 8192) continue;
    const attrs = attributes(match[0]);
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (/^<meta\b/i.test(match[0]) && attrs.content) {
      if (key === "og:image" || key === "og:image:secure_url") candidates.push({ priority: 1, value: attrs.content });
      if (key === "twitter:image" || key === "twitter:image:src") candidates.push({ priority: 2, value: attrs.content });
    }
    if (/^<img\b/i.test(match[0]) && ["amazon.com.br", "www.amazon.com.br", "amazon.com", "www.amazon.com"].includes(base.hostname)
      && ["landingImage", "imgBlkFront"].includes(attrs.id)) {
      for (const value of [attrs["data-old-hires"], attrs.src]) if (value) candidates.push({ priority: 0, value });
    }
  }
  for (const candidate of candidates.sort((a, b) => a.priority - b.priority)) {
    const result = imageUrl(candidate.value, base); if (result) return result;
  }
  return null;
}
