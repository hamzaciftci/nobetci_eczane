/**
 * GET /sitemap-pharmacies.xml
 * GET /sitemap-pharmacies.xml?page=N
 *
 * Eczane detay sayfalarını içerir.
 * Bu sitemap gelecekte /eczane/{slug} route'u aktif olduğunda dolacaktır.
 *
 * Şu an pharmacies tablosunda slug kolonu yoksa boş sitemap döner.
 * Kural:
 * - priority: 0.6
 * - changefreq: weekly (eczane detayları nadiren değişir)
 * - lastmod: pharmacy kaydının updated_at
 *
 * Pagination: 5000 URL/sayfa (max Vercel function timeout düşünülerek)
 */
import { withDb } from "../_lib/db.js";
import { cacheGet, cacheSet } from "../_lib/cache.js";
import { buildUrlSet, sendXml, toIsoDate, todayIso } from "./_xml.js";

const PAGE_SIZE = 5000;
const CACHE_TTL = 3600;
const CDN_TTL   = 3600;

function cacheKey(page) {
  return `sitemap:pharmacies:page:${page}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const pageParam = Number(req.query?.page ?? 1);
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

  const cached = await cacheGet(cacheKey(page));
  if (cached) return sendXml(res, cached, CDN_TTL);

  try {
    // pharmacies tablosunda slug kolonu yoksa boş sitemap döndür
    const hasSlug = await checkSlugColumn();
    if (!hasSlug) {
      const xml = buildUrlSet([]);
      await cacheSet(cacheKey(page), xml, CACHE_TTL);
      return sendXml(res, xml, CDN_TTL);
    }

    const rows = await withDb((db) => db`
      SELECT
        slug,
        updated_at
      FROM pharmacies
      WHERE slug IS NOT NULL
        AND slug != ''
      ORDER BY slug
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
    `);

    if (!rows.length && page > 1) {
      return res.status(404).end();
    }

    const fallbackDate = todayIso();
    const urls = rows.map(({ slug, updated_at }) => ({
      loc:        `/eczane/${slug}`,
      lastmod:    updated_at ? toIsoDate(updated_at) : fallbackDate,
      changefreq: "weekly",
      priority:   "0.6",
    }));

    const xml = buildUrlSet(urls);
    await cacheSet(cacheKey(page), xml, CACHE_TTL);
    return sendXml(res, xml, CDN_TTL);
  } catch (error) {
    console.error("[sitemap:pharmacies] error:", error?.message);
    return res.status(500).end();
  }
}

let _slugColChecked = null;

async function checkSlugColumn() {
  if (_slugColChecked !== null) return _slugColChecked;
  try {
    await withDb((db) => db`
      SELECT slug FROM pharmacies LIMIT 1
    `);
    _slugColChecked = true;
  } catch {
    _slugColChecked = false;
  }
  return _slugColChecked;
}
