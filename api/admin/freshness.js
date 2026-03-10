/**
 * GET /api/admin/freshness
 *
 * 81 ilin veri tazeliği durumunu döndürür.
 * source_health tablosunu kullanır (loggingLayer.updateSourceHealth tarafından beslenir).
 *
 * Response:
 * {
 *   summary: { healthy, stale_warning, stale_critical, unhealthy },
 *   provinces: [{ il, il_name, minutes_since_success, status, ... }]
 * }
 */
import { withDb } from "../_lib/db.js";
import { methodNotAllowed, requireAdmin, sendInternalError, sendJson } from "../_lib/http.js";
import { checkRateLimit } from "../_lib/security.js";

const STALE_WARNING_MINUTES  = 130;
const STALE_CRITICAL_MINUTES = 370;

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(req, res, ["GET"]);
  if (!await checkRateLimit(req, res)) return;
  if (!requireAdmin(req, res)) return;

  try {
    const rows = await withDb((db) =>
      db`
        SELECT
          p.slug                        AS il,
          p.name                        AS il_name,
          sh.last_success_at,
          sh.last_attempt_at,
          sh.consecutive_failures,
          sh.last_pharmacy_count,
          sh.avg_pharmacy_count_7d,
          sh.last_district_exact,
          sh.last_district_normalized,
          sh.last_district_alias,
          sh.last_district_fuzzy,
          sh.last_district_fallback,
          sh.is_healthy,
          sh.last_failure_reason,
          extract(epoch FROM (now() - sh.last_success_at)) / 60.0 AS minutes_since_success
        FROM provinces    p
        LEFT JOIN source_health sh ON sh.province_id = p.id
        ORDER BY
          CASE
            WHEN sh.last_success_at IS NULL                           THEN 0
            WHEN extract(epoch FROM (now() - sh.last_success_at)) / 60.0 > ${STALE_CRITICAL_MINUTES} THEN 1
            WHEN extract(epoch FROM (now() - sh.last_success_at)) / 60.0 > ${STALE_WARNING_MINUTES}  THEN 2
            ELSE 3
          END,
          p.slug
      `
    );

    const now = Date.now();
    let healthy = 0, staleWarning = 0, staleCritical = 0, neverUpdated = 0;

    const provinces = rows.map((row) => {
      const minutes    = row.minutes_since_success != null ? Number(row.minutes_since_success) : null;
      const lastSuccess = row.last_success_at ? new Date(row.last_success_at).toISOString() : null;

      let freshnessStatus;
      if (minutes == null)               { freshnessStatus = "never_updated"; neverUpdated++; }
      else if (minutes > STALE_CRITICAL_MINUTES) { freshnessStatus = "critical"; staleCritical++; }
      else if (minutes > STALE_WARNING_MINUTES)  { freshnessStatus = "warning";  staleWarning++;  }
      else                               { freshnessStatus = "ok";       healthy++;       }

      return {
        il:                    row.il,
        il_name:               row.il_name,
        freshness_status:      freshnessStatus,
        minutes_since_success: minutes != null ? Math.round(minutes) : null,
        last_success_at:       lastSuccess,
        last_attempt_at:       row.last_attempt_at ? new Date(row.last_attempt_at).toISOString() : null,
        consecutive_failures:  Number(row.consecutive_failures || 0),
        is_healthy:            row.is_healthy ?? null,
        last_pharmacy_count:   row.last_pharmacy_count != null ? Number(row.last_pharmacy_count) : null,
        avg_pharmacy_count_7d: row.avg_pharmacy_count_7d != null ? Number(row.avg_pharmacy_count_7d) : null,
        last_failure_reason:   row.last_failure_reason ?? null,
        district_resolution: {
          exact:      Number(row.last_district_exact      || 0),
          normalized: Number(row.last_district_normalized || 0),
          alias:      Number(row.last_district_alias      || 0),
          fuzzy:      Number(row.last_district_fuzzy      || 0),
          fallback:   Number(row.last_district_fallback   || 0),
        },
      };
    });

    return sendJson(res, 200, {
      generated_at: new Date(now).toISOString(),
      thresholds: {
        warning_minutes:  STALE_WARNING_MINUTES,
        critical_minutes: STALE_CRITICAL_MINUTES,
      },
      summary: {
        total:          rows.length,
        healthy,
        stale_warning:  staleWarning,
        stale_critical: staleCritical,
        never_updated:  neverUpdated,
      },
      provinces,
    });
  } catch (error) {
    return sendInternalError(res, error);
  }
}
