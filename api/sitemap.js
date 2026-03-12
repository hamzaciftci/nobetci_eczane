/**
 * Sitemap Stratejisi — Türkiye Nöbetçi Eczane Dizini
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * vercel.json rewrites:
 *   /sitemap.xml          → /api/sitemap          (index)
 *   /sitemap-:name.xml    → /api/sitemap?name=:name
 *
 * Üretilen sitemap'lar:
 *   /sitemap.xml              → index (tüm alt sitemap'leri listeler)
 *   /sitemap-static.xml       → ana sayfa + statik sayfalar
 *   /sitemap-cities.xml       → 81 il sayfası  (/nobetci-eczane/:il)
 *   /sitemap-districts.xml    → ilçe sayfaları  (/nobetci-eczane/:il/:ilce)
 *   /sitemap-districts-2.xml  → ilçe sayfaları  (sayfa 2, gerekirse)
 *
 * Crawl Verimliliği:
 *   - Tip bazlı ayrım: şehirler / ilçeler ayrı sitemap
 *   - lastmod: DB'den gerçek güncelleme tarihi (source_health.last_success_at)
 *   - changefreq + priority: sayfa tipine göre optimize edildi
 *   - Redis cache: 1 saat TTL (duty data saatlik güncelleniyor)
 *   - 1000+ sayfa: tek sitemap'te, sitemapindex ile bölünmüş yapı
 *
 * Günlük otomatik güncelleme:
 *   - lastmod her istek için gerçek zamanlı hesaplanır
 *   - Redis TTL 3600 → her saat yeni tarih ile yenilenir
 *   - İngest sonrası sitemap cache'i temizlenebilir (CACHE_KEY ile)
 */

import { withDb }           from "./_lib/db.js";
import { cacheGet, cacheSet } from "./_lib/cache.js";

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const BASE_URL  = "https://www.bugunnobetcieczaneler.com";
const PAGE_SIZE = 1000;   // Google limiti: 50 000 URL / sitemap

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

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
    `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>${
      lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""
    }\n  </sitemap>`
  );
  return xmlDoc(
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</sitemapindex>`
  );
}

function buildUrlSet(urls) {
  const entries = urls.map(({ loc, lastmod, changefreq, priority }) => {
    const full = loc.startsWith("http") ? loc : `${BASE_URL}${loc}`;
    const parts = [`    <loc>${escapeXml(full)}</loc>`];
    if (lastmod)            parts.push(`    <lastmod>${lastmod}</lastmod>`);
    if (changefreq)         parts.push(`    <changefreq>${changefreq}</changefreq>`);
    if (priority != null)   parts.push(`    <priority>${priority}</priority>`);
    return `  <url>\n${parts.join("\n")}\n  </url>`;
  });
  return xmlDoc(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`
  );
}

/** Bugünün tarihini İstanbul saatiyle (UTC+3) döner → "YYYY-MM-DD" */
function todayIstanbul() {
  const now = new Date();
  const offset = 3 * 60;   // UTC+3 dakika
  const istMs = now.getTime() + (now.getTimezoneOffset() + offset) * 60_000;
  return new Date(istMs).toISOString().slice(0, 10);
}

function toIsoDate(d) {
  if (!d) return todayIstanbul();
  return new Date(d).toISOString().slice(0, 10);
}

function sendXml(res, xml, maxAge = 3600) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", `public, s-maxage=${maxAge}, stale-while-revalidate=60`);
  res.status(200).send(xml);
}

// ─── Sitemap Handlers ─────────────────────────────────────────────────────────

/**
 * /sitemap.xml — Sitemapindex
 *
 * Yapı (Google'ın önerdiği tip bazlı ayrım):
 *   sitemap-static.xml       → statik sayfalar (değişmez)
 *   sitemap-cities.xml       → 81 il (saatlik güncelleme)
 *   sitemap-districts.xml    → ilçeler (saatlik güncelleme)
 *   sitemap-districts-2.xml  → 2. ilçe sayfası (gerekirse)
 *
 * İlçe sayısı DB'den sorgulanır; kaç sayfa gerektiği dinamik belirlenir.
 */
async function serveIndex(res) {
  const CACHE_KEY = "sitemap:index:v2";
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return sendXml(res, cached, 3600);

  const today = todayIstanbul();

  // Kaç ilçe var? → kaç sayfa districts sitemap gerekli?
  let totalDistricts = 0;
  try {
    const [row] = await withDb((db) => db`
      SELECT COUNT(*)::int AS cnt
      FROM districts d
      JOIN provinces p ON p.id = d.province_id
    `);
    totalDistricts = row?.cnt ?? 0;
  } catch {
    totalDistricts = 1000; // fallback estimate
  }

  const districtPages = Math.max(1, Math.ceil(totalDistricts / PAGE_SIZE));

  // Sitemap listesi
  const sitemaps = [
    { loc: `${BASE_URL}/sitemap-static.xml`,    lastmod: today },
    { loc: `${BASE_URL}/sitemap-cities.xml`,     lastmod: today },
    ...Array.from({ length: districtPages }, (_, i) => {
      const page = i + 1;
      const name = page === 1 ? "districts" : `districts-${page}`;
      return { loc: `${BASE_URL}/sitemap-${name}.xml`, lastmod: today };
    }),
  ];

  const xml = buildSitemapIndex(sitemaps);
  await cacheSet(CACHE_KEY, xml, 3600);
  return sendXml(res, xml, 3600);
}

/** /sitemap-static.xml — Ana sayfa + sabit sayfalar */
async function serveStatic(res) {
  const CACHE_KEY = "sitemap:static:v2";
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return sendXml(res, cached, 86400);

  const today = todayIstanbul();
  const urls = [
    { loc: "/",         changefreq: "hourly",  priority: "1.0", lastmod: today },
    { loc: "/en-yakin", changefreq: "daily",   priority: "0.6", lastmod: today },
    { loc: "/iletisim", changefreq: "monthly", priority: "0.3", lastmod: today },
  ];

  const xml = buildUrlSet(urls);
  await cacheSet(CACHE_KEY, xml, 86400);
  return sendXml(res, xml, 86400);
}

/**
 * /sitemap-cities.xml — 81 il sayfası
 *
 * URL örneği : /nobetci-eczane/osmaniye
 * lastmod    : source_health tablosundaki son başarılı ingest tarihi
 * changefreq : hourly (veriler her saat değişiyor)
 * priority   : 0.9 (sitelerin en önemli sayfaları)
 */
async function serveCities(res) {
  const CACHE_KEY = "sitemap:cities:v2";
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return sendXml(res, cached, 3600);

  let rows;
  try {
    rows = await withDb((db) => db`
      SELECT p.slug, MAX(sh.last_success_at) AS last_success_at
      FROM provinces p
      LEFT JOIN source_health sh ON sh.province_id = p.id
      GROUP BY p.slug
      ORDER BY p.slug
    `);
  } catch {
    // source_health henüz yoksa sadece slug'larla devam et
    try {
      rows = await withDb((db) => db`
        SELECT slug, NULL::timestamptz AS last_success_at
        FROM provinces
        ORDER BY slug
      `);
    } catch {
      rows = [];
    }
  }

  if (!rows.length) return res.status(404).end();

  const today = todayIstanbul();
  const urls = rows.map(({ slug, last_success_at }) => ({
    loc:        `/nobetci-eczane/${slug}`,
    lastmod:    last_success_at ? toIsoDate(last_success_at) : today,
    changefreq: "hourly",
    priority:   "0.9",
  }));

  const xml = buildUrlSet(urls);
  await cacheSet(CACHE_KEY, xml, 3600);
  return sendXml(res, xml, 3600);
}

/**
 * /sitemap-districts.xml + /sitemap-districts-N.xml — İlçe sayfaları
 *
 * URL örneği : /nobetci-eczane/osmaniye/duzici
 * lastmod    : source_health tablosundaki son başarılı ingest tarihi
 * changefreq : hourly
 * priority   : 0.8
 *
 * Sayfalama: PAGE_SIZE = 1000
 * Türkiye'de ~973 ilçe var → tek sayfaya sığar
 */
async function serveDistricts(res, page) {
  const CACHE_KEY = `sitemap:districts:v2:page:${page}`;
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return sendXml(res, cached, 3600);

  let rows;
  try {
    rows = await withDb((db) => db`
      SELECT
        d.slug  AS ilce_slug,
        p.slug  AS il_slug,
        MAX(sh.last_success_at) AS last_success_at
      FROM districts d
      JOIN provinces p   ON p.id = d.province_id
      LEFT JOIN source_health sh ON sh.province_id = p.id
      GROUP BY d.slug, p.slug
      ORDER BY p.slug, d.slug
      LIMIT  ${PAGE_SIZE}
      OFFSET ${(page - 1) * PAGE_SIZE}
    `);
  } catch {
    try {
      rows = await withDb((db) => db`
        SELECT
          d.slug AS ilce_slug,
          p.slug AS il_slug,
          NULL::timestamptz AS last_success_at
        FROM districts d
        JOIN provinces p ON p.id = d.province_id
        ORDER BY p.slug, d.slug
        LIMIT  ${PAGE_SIZE}
        OFFSET ${(page - 1) * PAGE_SIZE}
      `);
    } catch {
      rows = [];
    }
  }

  if (!rows.length) return res.status(404).end();

  const today = todayIstanbul();
  const urls = rows.map(({ il_slug, ilce_slug, last_success_at }) => ({
    loc:        `/nobetci-eczane/${il_slug}/${ilce_slug}`,
    lastmod:    last_success_at ? toIsoDate(last_success_at) : today,
    changefreq: "hourly",
    priority:   "0.8",
  }));

  const xml = buildUrlSet(urls);
  await cacheSet(CACHE_KEY, xml, 3600);
  return sendXml(res, xml, 3600);
}

/** Eczane slug sayfaları — henüz aktif değil */
async function servePharmacies(res, page) {
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

  const today = todayIstanbul();
  const urls = rows.map(({ slug, updated_at }) => ({
    loc:        `/eczane/${slug}`,
    lastmod:    updated_at ? toIsoDate(updated_at) : today,
    changefreq: "weekly",
    priority:   "0.6",
  }));
  return sendXml(res, buildUrlSet(urls), 3600);
}

/** Blog sayfaları — henüz aktif değil */
async function serveBlog(res) {
  let rows = [];
  try {
    rows = await withDb((db) => db`
      SELECT slug, published_at, updated_at FROM blog_posts
      WHERE published_at IS NOT NULL
      ORDER BY published_at DESC
    `);
  } catch { /* tablo yok */ }
  if (!rows.length) return res.status(404).end();

  const freshCutoff = Date.now() - 90 * 86400 * 1000;
  const today       = todayIstanbul();
  const urls = rows.map(({ slug, published_at, updated_at }) => ({
    loc:        `/blog/${slug}`,
    lastmod:    updated_at ? toIsoDate(updated_at) : (published_at ? toIsoDate(published_at) : today),
    changefreq: "weekly",
    priority:   new Date(published_at).getTime() > freshCutoff ? "0.7" : "0.5",
  }));
  return sendXml(res, buildUrlSet(urls), 3600);
}

// ─── Route Çözümleyici ─────────────────────────────────────────────────────────

/**
 * "districts-2" → { base: "districts", page: 2 }
 * "cities"      → { base: "cities",    page: 1 }
 */
function parseName(name) {
  if (!name) return { base: null, page: 1 };
  const m = name.match(/^(.+)-(\d+)$/);
  if (m) return { base: m[1], page: parseInt(m[2], 10) };
  return { base: name, page: 1 };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const rawName = req.query?.name || null;
  const { base, page } = parseName(rawName);

  try {
    switch (base) {
      case null:
        return await serveIndex(res);
      case "static":
        return await serveStatic(res);
      // "cities" yeni isim; eski "provinces" geriye dönük uyumluluk için korunuyor
      case "cities":
      case "provinces":
        return await serveCities(res);
      // "districts" + "districts-N" sayfalama
      case "districts":
        return await serveDistricts(res, page);
      case "pharmacies":
        return await servePharmacies(res, page);
      case "blog":
        return await serveBlog(res);
      default:
        return res.status(404).end();
    }
  } catch (err) {
    console.error(`[sitemap:${rawName ?? "index"}]`, err?.message);
    return res.status(500).end();
  }
}
