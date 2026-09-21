import { headers } from "next/headers";
import { resolveQuoteRequest } from "./quote-context";

export async function resolveQuotePage(search: Record<string, string | string[] | undefined>, slug?: string) {
  const url = new URL("http://internal/quotes");
  for (const value of Array.isArray(search.creator) ? search.creator : search.creator !== undefined ? [search.creator] : []) {
    url.searchParams.append("creator", value);
  }
  return resolveQuoteRequest(new Request(url, { headers: await headers() }), slug);
}
