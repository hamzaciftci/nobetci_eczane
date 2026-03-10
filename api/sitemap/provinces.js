/**
 * GET /sitemap-provinces.xml
 *
 * Türkiye'deki tüm 81 ilin nöbetçi eczane sayfalarını içerir.
 * provinces tablosundan çekilir; Redis'te 1 saat cache'lenir.
 *
 * Her il için üretilen URL'ler:
 *   /il/{slug}                    ← bugünkü nöbetçi eczaneler
 *
 * Kural:
 * - priority: 0.8 (ana içerik sayfaları)
 * - changefreq: hourly (veri her saat güncelleniyor)
 * - lastmod: source_health.last_success_at (gerçek veri tazeliği)
 */
import { withDb } from "../_lib/db.js";
import { cacheGet, cacheSet } from "../_lib/cache.js";
import { buildUrlSet, sendXml, toIsoDate, todayIso } from "./_xml.js";

const CACHE_KEY = "sitemap:provinces";
const CACHE_TTL = 3600; // 1 saat
const CDN_TTL   = 3600;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405); return res.end();
  }

  const cached = await cacheGet(CACHE_KEY);
  if (cached) return sendXml(res, cached, CDN_TTL);

  try {
    const rows = await withDb((db) => db`
      SELECT
        p.slug,
        sh.last_success_at
      FROM provinces p
      LEFT JOIN source_health sh ON sh.province_id = p.id
      ORDER BY p.slug
    `);

    const fallbackDate = todayIso();
    const urls = rows.map(({ slug, last_success_at }) => ({
      loc:        `/il/${slug}`,
      lastmod:    last_success_at ? toIsoDate(last_success_at) : fallbackDate,
      changefreq: "hourly",
      priority:   "0.8",
    }));

    const xml = buildUrlSet(urls);
    await cacheSet(CACHE_KEY, xml, CACHE_TTL);
    return sendXml(res, xml, CDN_TTL);
  } catch (error) {
    console.error("[sitemap:provinces] error:", error?.message);
    res.status(500); return res.end();
  }
}
