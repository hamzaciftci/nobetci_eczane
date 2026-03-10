/**
 * GET /sitemap-districts.xml          ← ilk sayfa (veya tek sayfa)
 * GET /sitemap-districts.xml?page=2   ← 2. sayfa
 *
 * Türkiye'deki tüm ilçelerin nöbetçi eczane sayfalarını içerir.
 * ~970 ilçe var; pagination 500 URL/sayfa.
 *
 * Sitemap index birden fazla sayfa varsa:
 *   /sitemap-districts.xml?page=1
 *   /sitemap-districts.xml?page=2
 *
 * districts tablosu veya pharmacies tablosundan ilçe slug'ları çekilir.
 * Her ilçe için:
 *   /il/{il_slug}/{ilce_slug}
 *
 * Kural:
 * - priority: 0.7
 * - changefreq: hourly
 * - lastmod: source_health.last_success_at (ilin son başarılı veri zamanı)
 */
import { withDb } from "../_lib/db.js";
import { cacheGet, cacheSet } from "../_lib/cache.js";
import { buildUrlSet, buildSitemapIndex, sendXml, toIsoDate, todayIso, BASE_URL } from "./_xml.js";

const PAGE_SIZE  = 500;
const CACHE_TTL  = 3600;
const CDN_TTL    = 3600;

function cacheKey(page) {
  return `sitemap:districts:page:${page}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405); return res.end();
  }

  const pageParam = Number(req.query?.page ?? 1);
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

  // page=0 özel: sitemap index modunda çalış (kaç sayfa var?)
  if (req.query?.page === "index") {
    return handleIndex(req, res);
  }

  const cached = await cacheGet(cacheKey(page));
  if (cached) return sendXml(res, cached, CDN_TTL);

  try {
    const rows = await withDb((db) => db`
      SELECT
        d.slug          AS ilce_slug,
        p.slug          AS il_slug,
        sh.last_success_at
      FROM districts d
      JOIN provinces p ON p.id = d.province_id
      LEFT JOIN source_health sh ON sh.province_id = p.id
      ORDER BY p.slug, d.slug
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
    `);

    if (!rows.length && page > 1) {
      res.status(404); return res.end();
    }

    const fallbackDate = todayIso();
    const urls = rows.map(({ il_slug, ilce_slug, last_success_at }) => ({
      loc:        `/il/${il_slug}/${ilce_slug}`,
      lastmod:    last_success_at ? toIsoDate(last_success_at) : fallbackDate,
      changefreq: "hourly",
      priority:   "0.7",
    }));

    const xml = buildUrlSet(urls);
    await cacheSet(cacheKey(page), xml, CACHE_TTL);
    return sendXml(res, xml, CDN_TTL);
  } catch (error) {
    console.error("[sitemap:districts] error:", error?.message);
    res.status(500); return res.end();
  }
}

/**
 * Kaç sayfa gerektiğini hesaplar ve sitemap index döndürür.
 * sitemap/index.js bu endpoint'i çağırmak yerine
 * doğrudan page=1 URL'ini kullanır (tek sayfa varsayımı).
 * Çok sayıda ilçe varsa sitemap/index.js güncellenmeli.
 */
async function handleIndex(req, res) {
  const CACHE_KEY_IDX = "sitemap:districts:index";
  const cached = await cacheGet(CACHE_KEY_IDX);
  if (cached) return sendXml(res, cached, CDN_TTL);

  try {
    const [{ count }] = await withDb((db) => db`
      SELECT COUNT(*) AS count FROM districts
    `);
    const total = Number(count);
    const pages = Math.ceil(total / PAGE_SIZE) || 1;

    const today = todayIso();
    const sitemaps = Array.from({ length: pages }, (_, i) => ({
      loc:     `${BASE_URL}/sitemap-districts.xml?page=${i + 1}`,
      lastmod: today,
    }));

    const xml = buildSitemapIndex(sitemaps);
    await cacheSet(CACHE_KEY_IDX, xml, CACHE_TTL);
    return sendXml(res, xml, CDN_TTL);
  } catch (error) {
    console.error("[sitemap:districts:index] error:", error?.message);
    res.status(500); return res.end();
  }
}
