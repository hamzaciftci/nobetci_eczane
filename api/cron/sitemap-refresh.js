/**
 * POST /api/cron/sitemap-refresh
 *
 * Sitemap cache'ini ısıtır ve Google Search Console'a ping atar.
 * Schedule: Günde 1-2 kez yeterli (sitemap-static hariç).
 *
 * Görevler:
 * 1. Tüm sitemap Redis key'lerini sil (cache bust)
 * 2. Her sitemap endpoint'ini sırayla çekerek yeni cache oluştur
 * 3. Google ve Bing'e sitemap ping gönder
 *
 * Not: Bu endpoint aynı zamanda manuel tetikleme için de kullanılabilir
 * (admin paneli veya deploy hook).
 */
import { cacheDel } from "../_lib/cache.js";
import { requireCronAuth } from "../_lib/cronAuth.js";
import { sendJson } from "../_lib/http.js";

export const config = { maxDuration: 60 };

const BASE_URL = "https://bugunnobetcieczaneler.com";

const SITEMAP_ENDPOINTS = [
  `${BASE_URL}/sitemap.xml`,
  `${BASE_URL}/sitemap-static.xml`,
  `${BASE_URL}/sitemap-provinces.xml`,
  `${BASE_URL}/sitemap-districts.xml`,
  `${BASE_URL}/sitemap-pharmacies.xml`,
  `${BASE_URL}/sitemap-blog.xml`,
];

const SITEMAP_CACHE_KEYS = [
  "sitemap:index",
  "sitemap:static",
  "sitemap:provinces",
  "sitemap:districts:page:1",
  "sitemap:districts:page:2",
  "sitemap:districts:page:3",
  "sitemap:districts:index",
  "sitemap:pharmacies:page:1",
  "sitemap:blog",
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  if (!requireCronAuth(req, res)) return;

  const startedAt = Date.now();
  const report = { warmed: [], failed: [], pinged: [] };

  // 1. Cache bust
  await cacheDel(SITEMAP_CACHE_KEYS);

  // 2. Cache warm — her endpoint'i sırayla çek
  for (const url of SITEMAP_ENDPOINTS) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "SitemapRefreshBot/1.0 (internal)" },
        signal: AbortSignal.timeout(15_000),
      });
      if (r.ok) {
        report.warmed.push(url);
      } else {
        report.failed.push({ url, status: r.status });
      }
    } catch (err) {
      report.failed.push({ url, error: err?.message });
    }
  }

  // 3. Search engine ping
  const sitemapIndexUrl = encodeURIComponent(`${BASE_URL}/sitemap.xml`);
  const pingTargets = [
    `https://www.google.com/ping?sitemap=${sitemapIndexUrl}`,
    `https://www.bing.com/ping?sitemap=${sitemapIndexUrl}`,
  ];

  for (const pingUrl of pingTargets) {
    try {
      const r = await fetch(pingUrl, {
        signal: AbortSignal.timeout(10_000),
      });
      report.pinged.push({ url: pingUrl, status: r.status, ok: r.ok });
    } catch (err) {
      report.pinged.push({ url: pingUrl, error: err?.message });
    }
  }

  return sendJson(res, 200, {
    ok:         report.failed.length === 0,
    elapsed_ms: Date.now() - startedAt,
    warmed:     report.warmed.length,
    failed:     report.failed,
    pinged:     report.pinged,
  });
}
