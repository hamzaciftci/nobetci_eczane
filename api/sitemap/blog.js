/**
 * GET /sitemap-blog.xml
 *
 * Blog yazılarını içerir.
 * Şu an blog_posts tablosu yoksa boş sitemap döner (gelecek-ready).
 *
 * Tablo şeması beklentisi:
 *   blog_posts (slug TEXT, published_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
 *
 * Kural:
 * - priority: 0.7 (taze blog) → 0.5 (eski blog, >90 gün)
 * - changefreq: weekly
 * - lastmod: updated_at
 * - Sadece published (published_at IS NOT NULL) yazılar dahil edilir
 */
import { withDb } from "../_lib/db.js";
import { cacheGet, cacheSet } from "../_lib/cache.js";
import { buildUrlSet, sendXml, toIsoDate, todayIso } from "./_xml.js";

const CACHE_KEY = "sitemap:blog";
const CACHE_TTL = 3600;
const CDN_TTL   = 3600;

const FRESH_DAYS = 90; // Bu kadar günden genç = yüksek priority

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const cached = await cacheGet(CACHE_KEY);
  if (cached) return sendXml(res, cached, CDN_TTL);

  try {
    const hasTable = await checkBlogTable();
    if (!hasTable) {
      const xml = buildUrlSet([]);
      await cacheSet(CACHE_KEY, xml, CACHE_TTL);
      return sendXml(res, xml, CDN_TTL);
    }

    const rows = await withDb((db) => db`
      SELECT
        slug,
        published_at,
        updated_at
      FROM blog_posts
      WHERE published_at IS NOT NULL
      ORDER BY published_at DESC
    `);

    const now = Date.now();
    const freshCutoff = now - FRESH_DAYS * 86400 * 1000;
    const fallbackDate = todayIso();

    const urls = rows.map(({ slug, published_at, updated_at }) => {
      const pubMs    = published_at ? new Date(published_at).getTime() : 0;
      const isFresh  = pubMs > freshCutoff;
      return {
        loc:        `/blog/${slug}`,
        lastmod:    updated_at ? toIsoDate(updated_at) : (published_at ? toIsoDate(published_at) : fallbackDate),
        changefreq: "weekly",
        priority:   isFresh ? "0.7" : "0.5",
      };
    });

    const xml = buildUrlSet(urls);
    await cacheSet(CACHE_KEY, xml, CACHE_TTL);
    return sendXml(res, xml, CDN_TTL);
  } catch (error) {
    console.error("[sitemap:blog] error:", error?.message);
    return res.status(500).end();
  }
}

let _blogTableChecked = null;

async function checkBlogTable() {
  if (_blogTableChecked !== null) return _blogTableChecked;
  try {
    await withDb((db) => db`SELECT 1 FROM blog_posts LIMIT 1`);
    _blogTableChecked = true;
  } catch {
    _blogTableChecked = false;
  }
  return _blogTableChecked;
}
