/**
 * GET /sitemap.xml              → tüm alt sitemap'leri listeleyen index
 * GET /sitemap-{name}.xml       → ilgili alt sitemap
 *
 * vercel.json rewrites:
 *   /sitemap.xml          → /api/sitemap
 *   /sitemap-:name.xml    → /api/sitemap?name=:name
 *
 * Tüm sitemap mantığı tek bir Serverless Function'da toplanmıştır
 * (Vercel Hobby plan: maks 12 function limiti).
 */
import { withDb } from "./_lib/db.js";
import { cacheGet, cacheSet, cacheDel } from "./_lib/cache.js";

const BASE_URL  = "https://bugunnobetcieczaneler.com";
const PAGE_SIZE = 500;

// ─── XML Helpers ──────────────────────────────────────────────────────────────

function escapeXml(str) {
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&apos;");
}

function xmlDoc(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`;
}

function buildSitemapIndex(sitemaps) {
  const entries = sitemaps.map(({ loc, lastmod }) =>
    `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}\n  </sitemap>`
  );
  return xmlDoc(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</sitemapindex>`);
}

function buildUrlSet(urls) {
  const entries = urls.map(({ loc, lastmod, changefreq, priority }) => {
    const parts = [`    <loc>${escapeXml(loc.startsWith("http") ? loc : `${BASE_URL}${loc.startsWith("/") ? loc : `/${loc}`}`)}</loc>`];
    if (lastmod)       parts.push(`    <lastmod>${lastmod}</lastmod>`);
    if (changefreq)    parts.push(`    <changefreq>${changefreq}</changefreq>`);
    if (priority != null) parts.push(`    <priority>${priority}</priority>`);
    return `  <url>\n${parts.join("\n")}\n  </url>`;
  });
  return xmlDoc(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toIsoDate(d) {
  if (!d) return todayIso();
  return new Date(d).toISOString().slice(0, 10);
}

function sendXml(res, xml, maxAge = 3600) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", `public, s-maxage=${maxAge}, stale-while-revalidate=60`);
  res.status(200);
  res.send(xml);
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function serveIndex(res) {
  const CACHE_KEY = "sitemap:index";
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return sendXml(res, cached, 3600);

  const today = todayIso();
  // pharmacies ve blog henüz URL içermediğinden index'e dahil edilmiyor
  const names = ["static", "provinces", "districts"];
  const sitemaps = names.map((name) => ({
    loc:     `${BASE_URL}/sitemap-${name}.xml`,
    lastmod: today,
  }));

  const xml = buildSitemapIndex(sitemaps);
  await cacheSet(CACHE_KEY, xml, 3600);
  return sendXml(res, xml, 3600);
}

async function serveStatic(res) {
  const CACHE_KEY = "sitemap:static";
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return sendXml(res, cached, 86400);

  const lastmod = todayIso();
  const urls = [
    { loc: "/",         changefreq: "hourly",  priority: "1.0", lastmod },
    { loc: "/iletisim", changefreq: "monthly", priority: "0.4", lastmod },
  ];

  const xml = buildUrlSet(urls);
  await cacheSet(CACHE_KEY, xml, 86400);
  return sendXml(res, xml, 86400);
}

async function serveProvinces(res) {
  const CACHE_KEY = "sitemap:provinces";
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return sendXml(res, cached, 3600);

  let rows;
  try {
    rows = await withDb((db) => db`
      SELECT p.slug, sh.last_success_at
      FROM provinces p
      LEFT JOIN source_health sh ON sh.province_id = p.id
      ORDER BY p.slug
    `);
  } catch {
    // source_health tablosu henüz oluşturulmamışsa sadece slug'larla devam et
    rows = await withDb((db) => db`SELECT slug, null::timestamptz AS last_success_at FROM provinces ORDER BY slug`);
  }

  const fallback = todayIso();
  const urls = rows.map(({ slug, last_success_at }) => ({
    loc:        `/il/${slug}`,
    lastmod:    last_success_at ? toIsoDate(last_success_at) : fallback,
    changefreq: "hourly",
    priority:   "0.8",
  }));

  const xml = buildUrlSet(urls);
  await cacheSet(CACHE_KEY, xml, 3600);
  return sendXml(res, xml, 3600);
}

async function serveDistricts(res, page) {
  const CACHE_KEY = `sitemap:districts:page:${page}`;
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return sendXml(res, cached, 3600);

  let rows;
  try {
    rows = await withDb((db) => db`
      SELECT d.slug AS ilce_slug, p.slug AS il_slug, sh.last_success_at
      FROM districts d
      JOIN provinces p ON p.id = d.province_id
      LEFT JOIN source_health sh ON sh.province_id = p.id
      ORDER BY p.slug, d.slug
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
    `);
  } catch {
    rows = await withDb((db) => db`
      SELECT d.slug AS ilce_slug, p.slug AS il_slug, null::timestamptz AS last_success_at
      FROM districts d
      JOIN provinces p ON p.id = d.province_id
      ORDER BY p.slug, d.slug
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
    `);
  }

  if (!rows.length && page > 1) return res.status(404).end();

  const fallback = todayIso();
  const urls = rows.map(({ il_slug, ilce_slug, last_success_at }) => ({
    loc:        `/il/${il_slug}/${ilce_slug}`,
    lastmod:    last_success_at ? toIsoDate(last_success_at) : fallback,
    changefreq: "hourly",
    priority:   "0.7",
  }));

  const xml = buildUrlSet(urls);
  await cacheSet(CACHE_KEY, xml, 3600);
  return sendXml(res, xml, 3600);
}

async function servePharmacies(res, page) {
  const CACHE_KEY = `sitemap:pharmacies:page:${page}`;
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return sendXml(res, cached, 3600);

  // slug kolonu yoksa boş sitemap döndür
  let rows = [];
  try {
    rows = await withDb((db) => db`
      SELECT slug, updated_at FROM pharmacies
      WHERE slug IS NOT NULL AND slug != ''
      ORDER BY slug
      LIMIT 5000 OFFSET ${(page - 1) * 5000}
    `);
  } catch { /* tablo/kolon yok */ }

  if (!rows.length) return res.status(404).end();

  const fallback = todayIso();
  const urls = rows.map(({ slug, updated_at }) => ({
    loc:        `/eczane/${slug}`,
    lastmod:    updated_at ? toIsoDate(updated_at) : fallback,
    changefreq: "weekly",
    priority:   "0.6",
  }));

  const xml = buildUrlSet(urls);
  await cacheSet(CACHE_KEY, xml, 3600);
  return sendXml(res, xml, 3600);
}

async function serveBlog(res) {
  const CACHE_KEY = "sitemap:blog";
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return sendXml(res, cached, 3600);

  let rows = [];
  try {
    rows = await withDb((db) => db`
      SELECT slug, published_at, updated_at FROM blog_posts
      WHERE published_at IS NOT NULL
      ORDER BY published_at DESC
    `);
  } catch { /* tablo yok */ }

  if (!rows.length) return res.status(404).end();

  const now = Date.now();
  const freshCutoff = now - 90 * 86400 * 1000;
  const fallback = todayIso();

  const urls = rows.map(({ slug, published_at, updated_at }) => ({
    loc:        `/blog/${slug}`,
    lastmod:    updated_at ? toIsoDate(updated_at) : (published_at ? toIsoDate(published_at) : fallback),
    changefreq: "weekly",
    priority:   new Date(published_at).getTime() > freshCutoff ? "0.7" : "0.5",
  }));

  const xml = buildUrlSet(urls);
  await cacheSet(CACHE_KEY, xml, 3600);
  return sendXml(res, xml, 3600);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405);
    return res.end();
  }

  const name = req.query?.name || null;
  const page = Math.max(1, Number(req.query?.page ?? 1) || 1);

  try {
    switch (name) {
      case null:
      case undefined:
        return await serveIndex(res);
      case "static":
        return await serveStatic(res);
      case "provinces":
        return await serveProvinces(res);
      case "districts":
        return await serveDistricts(res, page);
      case "pharmacies":
        return await servePharmacies(res, page);
      case "blog":
        return await serveBlog(res);
      default:
        res.status(404);
        return res.end();
    }
  } catch (error) {
    console.error(`[sitemap:${name ?? "index"}] error:`, error?.message);
    res.status(500);
    return res.end();
  }
}
