import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIPv4 } from "node:net";
import { extractRecommendationImage, recommendationProductUrl, RecommendationImageError } from "./recommendation-image";

const MAX_BYTES = 1024 * 1024;
type Page = { status: number; location?: string; html: string };

export function publicIpv4(address: string) {
  if (!isIPv4(address)) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}

async function readPage(url: URL, signal: AbortSignal): Promise<Page> {
  const addresses = (await lookup(url.hostname, { family: 4, all: true })).map((entry) => entry.address);
  signal.throwIfAborted();
  if (!addresses.length || addresses.some((address) => !publicIpv4(address))) throw new RecommendationImageError("unavailable");
  return new Promise((resolve, reject) => {
    // Connect to the validated IP: no second DNS lookup, proxy or connection reuse.
    // SNI and normal certificate verification retain the original store hostname.
    const req = request({ hostname: addresses[0], servername: url.hostname, port: 443, method: "GET", agent: false,
      path: url.pathname + url.search, signal, maxHeaderSize: 16384,
      headers: { Host: url.hostname, Accept: "text/html", "Accept-Encoding": "identity", "User-Agent": "Ludylops-Product-Image/1.0" },
    }, (response) => {
      const status = response.statusCode ?? 0;
      response.on("error", reject);
      if ([301, 302, 303, 307, 308].includes(status)) {
        resolve({ status, location: response.headers.location, html: "" }); response.destroy(); return;
      }
      if (status !== 200 || !/^text\/html(?:;|$)/i.test(response.headers["content-type"] ?? "")
        || (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity")) {
        reject(new RecommendationImageError("unavailable")); response.destroy(); return;
      }
      const chunks: Buffer[] = []; let bytes = 0;
      response.on("data", (chunk: Buffer) => {
        chunks.push(chunk.subarray(0, MAX_BYTES - bytes));
        bytes += chunk.length;
        if (bytes >= MAX_BYTES) {
          // Stores often send large recommendation feeds after the product metadata.
          // Inspect only the bounded prefix and stop downloading the rest.
          resolve({ status, html: Buffer.concat(chunks).toString("utf8") }); response.destroy();
        }
      });
      response.on("end", () => resolve({ status, html: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject); req.end();
  });
}

export async function lookupRecommendationImage(href: string) {
  let url = recommendationProductUrl(href);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => {
    controller.abort(); reject(new RecommendationImageError("unavailable"));
  }, 8000); });
  try {
    return await Promise.race([timeout, (async () => {
      for (let hop = 0; hop <= 3; hop++) {
        const page = await readPage(url, controller.signal);
        if (page.status !== 200) {
          if (!page.location || hop === 3) throw new RecommendationImageError("unavailable");
          url = recommendationProductUrl(new URL(page.location, url).href); continue;
        }
        const imageUrl = extractRecommendationImage(page.html, url);
        if (!imageUrl) throw new RecommendationImageError("no_image");
        return { imageUrl };
      }
      throw new RecommendationImageError("unavailable");
    })()]);
  } catch (error) {
    if (error instanceof RecommendationImageError) throw error;
    throw new RecommendationImageError("unavailable");
  } finally { clearTimeout(timer!); controller.abort(); }
}

// Best-effort per-process budget. No credentials, URLs or metadata are retained.
const budgets = new Map<string, { count: number; expires: number; busy: boolean }>();
let active = 0;
export async function limitedRecommendationImage(key: string, href: string) {
  const now = Date.now();
  for (const [id, budget] of budgets) if (budget.expires <= now && !budget.busy) budgets.delete(id);
  let budget = budgets.get(key);
  if (active >= 8 || budget?.busy || (budget && budget.expires > now && budget.count >= 10) || (!budget && budgets.size >= 1000))
    throw new RecommendationImageError("rate_limit");
  if (!budget || budget.expires <= now) { budget = { count: 0, expires: now + 60000, busy: false }; budgets.set(key, budget); }
  budget.count++; budget.busy = true; active++;
  try { return await lookupRecommendationImage(href); }
  finally { budget.busy = false; active--; }
}
