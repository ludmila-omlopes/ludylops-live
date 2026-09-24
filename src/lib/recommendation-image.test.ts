import { describe, expect, it } from "vitest";
import { extractRecommendationImage as extract, recommendationProductUrl as productUrl } from "./recommendation-image";
const base = new URL("https://www.amazon.com.br/dp/example");
describe("product image metadata", () => {
  it("accepts exact supported hosts, preserves affiliate query parameters and removes fragments", () => {
    expect(productUrl("https://amzn.to/example?tag=creator#section").href).toBe("https://amzn.to/example?tag=creator");
    for (const host of ["www.amazon.com.br", "www.amazon.com", "produto.mercadolivre.com.br", "www.kabum.com.br", "www.magazineluiza.com.br"])
      expect(productUrl(`https://${host}/produto`).hostname).toBe(host);
  });
  it.each(["https://amazon.com.br.evil.test/x", "https://evil.amazon.com.br/x", "http://www.amazon.com.br/x", "https://www.amazon.com.br:8443/x", "https://user:secret@www.amazon.com.br/x", "https://127.0.0.1/x", "https://[::1]/", "file:///secret", "https://2130706433/", "not a url"])("rejects unsupported destination %s", (url) => {
    expect(() => productUrl(url)).toThrow("unsupported");
  });
  it("reads quoted/unquoted attributes in any order, case-insensitively, decoding entities once", () => {
    expect(extract('<META CONTENT="https://m.media-amazon.com/image.jpg?a=1&amp;b=2&#38;c=3&#x26;d=4" PROPERTY=og:image>', base))
      .toBe("https://m.media-amazon.com/image.jpg?a=1&b=2&c=3&d=4");
    expect(extract("<meta content='/image.jpg' name='twitter:image'>", base)).toBe("https://www.amazon.com.br/image.jpg");
    expect(extract('<meta property="og:image" content="//http2.mlstatic.com/image.jpg">', base)).toBe("https://http2.mlstatic.com/image.jpg");
  });
  it("prefers the Amazon product image, then Open Graph, then Twitter", () => {
    const html = '<meta name="twitter:image" content="/twitter.jpg"><meta property="og:image" content="/og.jpg"><img id="landingImage" src="/small.jpg" data-old-hires="https://m.media-amazon.com/large.jpg">';
    expect(extract(html, base)).toBe("https://m.media-amazon.com/large.jpg");
    expect(extract(html, new URL("https://www.kabum.com.br/item"))).toBe("https://www.kabum.com.br/og.jpg");
  });
  it("skips unsafe images and ignores scripts, comments and arbitrary images", () => {
    const invalid = ["javascript:alert(1)", "data:image/png,abc", "https://127.0.0.1/a", "https://m.media-amazon.com.evil.test/a", "https://user:pass@m.media-amazon.com/a", "http://m.media-amazon.com/a", "https://m.media-amazon.com:8443/a", ""];
    for (const value of invalid) expect(extract(`<meta property="og:image" content="${value}">`, base)).toBeNull();
    expect(extract('<script>const x = \'<meta property="og:image" content="/script.jpg">\';</script><!-- <meta property="og:image" content="/comment.jpg"> --><img src="/random.jpg">', base)).toBeNull();
    expect(extract('<script>const x = \'<meta property="og:image" content="/incomplete-script.jpg">', base)).toBeNull();
    expect(extract('<meta property="og:image" content="data:bad"><meta name="twitter:image" content="/good.jpg">', base)).toBe("https://www.amazon.com.br/good.jpg");
  });
});
