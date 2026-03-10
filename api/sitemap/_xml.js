/**
 * Sitemap XML builder utilities.
 * Tüm sitemap handler'ları bu modülü kullanır.
 */

const BASE_URL = "https://bugunnobetcieczaneler.com";

/**
 * Sitemap index XML üretir.
 * @param {Array<{loc: string, lastmod?: string}>} sitemaps
 */
export function buildSitemapIndex(sitemaps) {
  const entries = sitemaps.map(({ loc, lastmod }) => {
    const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
    return `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>${lastmodTag}\n  </sitemap>`;
  });
  return xmlDoc(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</sitemapindex>`);
}

/**
 * URL-set XML üretir (tekli sitemap dosyası).
 * @param {Array<{loc: string, lastmod?: string, changefreq?: string, priority?: string|number}>} urls
 */
export function buildUrlSet(urls) {
  const entries = urls.map(({ loc, lastmod, changefreq, priority }) => {
    const parts = [`    <loc>${escapeXml(absoluteUrl(loc))}</loc>`];
    if (lastmod)    parts.push(`    <lastmod>${lastmod}</lastmod>`);
    if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
    if (priority != null) parts.push(`    <priority>${priority}</priority>`);
    return `  <url>\n${parts.join("\n")}\n  </url>`;
  });
  return xmlDoc(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`);
}

/** Tam URL oluşturur — zaten http(s) ile başlıyorsa dokunmaz. */
export function absoluteUrl(path) {
  if (path.startsWith("http")) return path;
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** XML declaration + root node */
function xmlDoc(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`;
}

/** XML özel karakterlerini escape eder. */
export function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Bugünün ISO tarihini döndürür (YYYY-MM-DD). */
export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Verilen Date/string'i YYYY-MM-DD'ye çevirir. */
export function toIsoDate(d) {
  if (!d) return todayIso();
  return new Date(d).toISOString().slice(0, 10);
}

/**
 * Sitemap response gönderir — Content-Type, Cache-Control header'larını set eder.
 * @param {object} res
 * @param {string} xml
 * @param {number} [maxAge=3600]  s-maxage (CDN TTL), saniye
 */
export function sendXml(res, xml, maxAge = 3600) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  // Vercel Edge Network bu header'a göre cache eder
  res.setHeader("Cache-Control", `public, s-maxage=${maxAge}, stale-while-revalidate=60`);
  res.status(200);
  res.send(xml);
}

export { BASE_URL };
