/**
 * GET /sitemap-static.xml
 *
 * Statik sayfaları içerir. DB bağlantısı gerektirmez.
 * Cache TTL: 24 saat (içerik nadiren değişir).
 *
 * Kural:
 * - noindex sayfaları dahil edilmez  (embed, print, screen, admin)
 * - canonical URL'ler kullanılır
 */
import { cacheGet, cacheSet } from "../_lib/cache.js";
import { buildUrlSet, sendXml, todayIso } from "./_xml.js";

const CACHE_KEY = "sitemap:static";
const CACHE_TTL = 86400; // 24 saat
const CDN_TTL   = 86400;

/**
 * Statik sayfa listesi.
 * noindex sayfaları (embed, print, screen, admin) buraya eklenmez.
 */
const STATIC_PAGES = [
  { loc: "/",          changefreq: "hourly",  priority: "1.0" },
  { loc: "/iletisim",  changefreq: "monthly", priority: "0.4" },
  // Gelecekte eklenecekler:
  // { loc: "/hakkimizda", changefreq: "monthly", priority: "0.4" },
  // { loc: "/gizlilik",   changefreq: "yearly",  priority: "0.2" },
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const cached = await cacheGet(CACHE_KEY);
  if (cached) return sendXml(res, cached, CDN_TTL);

  const lastmod = todayIso();
  const urls = STATIC_PAGES.map((page) => ({ ...page, lastmod }));

  const xml = buildUrlSet(urls);
  await cacheSet(CACHE_KEY, xml, CACHE_TTL);
  return sendXml(res, xml, CDN_TTL);
}
