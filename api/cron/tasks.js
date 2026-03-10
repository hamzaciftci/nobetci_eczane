/**
 * POST /api/cron/tasks?task=freshness-check
 * POST /api/cron/tasks?task=sitemap-refresh
 *
 * Birden fazla cron görevini tek bir Serverless Function'da toplar.
 * (Vercel Hobby plan: maks 12 function limiti)
 *
 * GitHub Actions tarafından tetiklenir.
 */
import { withDb } from "../_lib/db.js";
import { cacheDel } from "../_lib/cache.js";
import { requireCronAuth } from "../_lib/cronAuth.js";
import { sendJson } from "../_lib/http.js";
import { logAlert } from "../_lib/ingest/loggingLayer.js";
import { dispatchPendingAlerts } from "../_lib/alertDispatcher.js";

export const config = { maxDuration: 60 };

const BASE_URL = "https://bugunnobetcieczaneler.com";

const STALE_WARNING_MINUTES  = 130;
const STALE_CRITICAL_MINUTES = 370;

const SITEMAP_CACHE_KEYS = [
  "sitemap:index", "sitemap:static", "sitemap:provinces",
  "sitemap:districts:page:1", "sitemap:districts:page:2", "sitemap:districts:page:3",
  "sitemap:districts:index", "sitemap:pharmacies:page:1", "sitemap:blog",
];

const SITEMAP_ENDPOINTS = [
  `${BASE_URL}/sitemap.xml`,
  `${BASE_URL}/sitemap-static.xml`,
  `${BASE_URL}/sitemap-provinces.xml`,
  `${BASE_URL}/sitemap-districts.xml`,
  `${BASE_URL}/sitemap-pharmacies.xml`,
  `${BASE_URL}/sitemap-blog.xml`,
];

// ─── Task: freshness-check ────────────────────────────────────────────────────

async function runFreshnessCheck() {
  const startedAt = Date.now();

  const { staleCount, criticalCount, checked, dispatched } = await withDb(async (sql) => {
    const rows = await sql`
      SELECT
        p.id            AS province_id,
        p.slug          AS il,
        p.name          AS il_name,
        max(ir.started_at) FILTER (WHERE ir.status = 'success')
          AS last_success_at,
        extract(epoch FROM (
          now() - max(ir.started_at) FILTER (WHERE ir.status = 'success')
        )) / 60.0
          AS minutes_since_success
      FROM provinces p
      LEFT JOIN sources          s  ON s.province_id  = p.id  AND s.enabled = true
      LEFT JOIN source_endpoints se ON se.source_id   = s.id  AND se.is_primary = true AND se.enabled = true
      LEFT JOIN ingestion_runs   ir ON ir.source_endpoint_id = se.id
        AND ir.started_at > now() - interval '24 hours'
      GROUP BY p.id, p.slug, p.name
      HAVING
            max(ir.started_at) FILTER (WHERE ir.status = 'success') IS NULL
        OR  extract(epoch FROM (
              now() - max(ir.started_at) FILTER (WHERE ir.status = 'success')
            )) / 60.0 > ${STALE_WARNING_MINUTES}
    `;

    let staleCount = 0, criticalCount = 0;

    for (const row of rows) {
      const minutes    = row.minutes_since_success != null ? Number(row.minutes_since_success) : 9999;
      const isCritical = minutes > STALE_CRITICAL_MINUTES;

      await logAlert(sql, {
        provinceId: Number(row.province_id),
        alertType:  isCritical ? "freshness_breach" : "stale_data",
        severity:   isCritical ? "high" : "medium",
        message:    minutes < 9000
          ? `Son basarili ingest ${Math.round(minutes)} dk once (${row.il_name})`
          : `Hic basarili ingest yok son 24 saatte (${row.il_name})`,
        payload: {
          minutes_since_success: Math.round(minutes),
          last_success_at:       row.last_success_at ?? null,
          threshold_warning:     STALE_WARNING_MINUTES,
          threshold_critical:    STALE_CRITICAL_MINUTES,
        },
      });

      if (isCritical) criticalCount++;
      else staleCount++;
    }

    const dispatched = await dispatchPendingAlerts(sql);
    return { staleCount, criticalCount, checked: rows.length, dispatched };
  });

  return {
    task:           "freshness-check",
    ok:             true,
    checked,
    stale_warning:  staleCount,
    stale_critical: criticalCount,
    dispatched,
    elapsed_ms:     Date.now() - startedAt,
  };
}

// ─── Task: sitemap-refresh ────────────────────────────────────────────────────

async function runSitemapRefresh() {
  const startedAt = Date.now();
  const report     = { warmed: [], failed: [], pinged: [] };

  await cacheDel(SITEMAP_CACHE_KEYS);

  for (const url of SITEMAP_ENDPOINTS) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "SitemapRefreshBot/1.0 (internal)" },
        signal:  AbortSignal.timeout(15_000),
      });
      r.ok ? report.warmed.push(url) : report.failed.push({ url, status: r.status });
    } catch (err) {
      report.failed.push({ url, error: err?.message });
    }
  }

  const sitemapUrl = encodeURIComponent(`${BASE_URL}/sitemap.xml`);
  for (const pingUrl of [
    `https://www.google.com/ping?sitemap=${sitemapUrl}`,
    `https://www.bing.com/ping?sitemap=${sitemapUrl}`,
  ]) {
    try {
      const r = await fetch(pingUrl, { signal: AbortSignal.timeout(10_000) });
      report.pinged.push({ url: pingUrl, status: r.status, ok: r.ok });
    } catch (err) {
      report.pinged.push({ url: pingUrl, error: err?.message });
    }
  }

  return {
    task:       "sitemap-refresh",
    ok:         report.failed.length === 0,
    warmed:     report.warmed.length,
    failed:     report.failed,
    pinged:     report.pinged,
    elapsed_ms: Date.now() - startedAt,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  if (!requireCronAuth(req, res)) return;

  const task = req.query?.task;

  try {
    switch (task) {
      case "freshness-check": {
        const result = await runFreshnessCheck();
        console.log(JSON.stringify({ scope: "freshness_check", ...result }));
        return sendJson(res, 200, result);
      }
      case "sitemap-refresh": {
        const result = await runSitemapRefresh();
        return sendJson(res, 200, result);
      }
      default:
        return sendJson(res, 400, { error: "unknown_task", valid: ["freshness-check", "sitemap-refresh"] });
    }
  } catch (err) {
    console.error(`[cron:tasks:${task}] fatal:`, err);
    return sendJson(res, 500, { error: "internal_error", message: err?.message });
  }
}
