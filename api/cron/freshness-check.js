/**
 * Freshness Check Cron — /api/cron/freshness-check
 *
 * Saatlik çalışır. Son N dakikada başarılı ingest'i olmayan iller için
 * stale_data ve freshness_breach alert'leri üretir.
 *
 * Vercel cron: "0 * * * *"
 */
import { withDb } from "../_lib/db.js";
import { logAlert } from "../_lib/ingest/loggingLayer.js";
import { requireCronAuth } from "../_lib/cronAuth.js";
import { sendJson } from "../_lib/http.js";
import { dispatchPendingAlerts } from "../_lib/alertDispatcher.js";

export const config = { maxDuration: 30 };

// Uyarı eşiği: son başarılı ingest bu süreyi aştıysa warning alert üret.
const STALE_WARNING_MINUTES = 130;  // 2 saat 10 dk (ingest her 30 dk'da bir, biraz tolerans)
// Kritik eşik: son başarılı ingest bu süreyi aştıysa critical alert üret.
const STALE_CRITICAL_MINUTES = 370; // 6 saat 10 dk

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  if (!requireCronAuth(req, res)) return;

  const startedAt = Date.now();

  try {
    const { staleCount, criticalCount, checked } = await withDb(async (sql) => {
      // Her ilin son 24 saatteki son BAŞARILI ingestion zamanını bul.
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

      let staleCount = 0;
      let criticalCount = 0;

      for (const row of rows) {
        const minutes = row.minutes_since_success != null
          ? Number(row.minutes_since_success)
          : 9999;

        const isCritical = minutes > STALE_CRITICAL_MINUTES;
        const severity = isCritical ? "high" : "medium";
        const alertType = isCritical ? "freshness_breach" : "stale_data";

        await logAlert(sql, {
          provinceId: Number(row.province_id),
          alertType,
          severity,
          message: minutes < 9000
            ? `Son basarili ingest ${Math.round(minutes)} dk once (${row.il_name})`
            : `Hic basarili ingest yok son 24 saatte (${row.il_name})`,
          payload: {
            minutes_since_success: Math.round(minutes),
            last_success_at:       row.last_success_at ?? null,
            threshold_warning:     STALE_WARNING_MINUTES,
            threshold_critical:    STALE_CRITICAL_MINUTES
          }
        });

        if (isCritical) criticalCount++;
        else staleCount++;
      }

      // Alert'leri DB'ye yazdıktan sonra dış kanallara (Telegram/Slack) gönder
      const dispatched = await dispatchPendingAlerts(sql);

      return { staleCount, criticalCount, checked: rows.length, dispatched };
    });

    const elapsed_ms = Date.now() - startedAt;
    console.log(JSON.stringify({
      scope: "freshness_check",
      checked,
      stale: staleCount,
      critical: criticalCount,
      elapsed_ms
    }));

    return sendJson(res, 200, {
      ok: true,
      checked,
      stale_warning:  staleCount,
      stale_critical: criticalCount,
      dispatched,
      elapsed_ms
    });
  } catch (err) {
    console.error("[freshness-check] fatal:", err);
    return sendJson(res, 500, { error: "internal_error", message: err.message });
  }
}
