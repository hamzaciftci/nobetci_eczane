import { withDb } from "../../_lib/db.js";
import { methodNotAllowed, requireAdmin, sendInternalError, sendJson } from "../../_lib/http.js";
import { checkRateLimit } from "../../_lib/security.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }
  if (!await checkRateLimit(req, res)) {
    return;
  }
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const rows = await withDb((db) =>
      db`
        SELECT
          p.slug                AS il,
          p.name                AS il_name,

          -- Son 24 saat ingest özeti
          coalesce(sum(CASE WHEN ir.status = 'success' THEN 1 ELSE 0 END), 0)::int  AS success_count,
          coalesce(sum(CASE WHEN ir.status = 'failed'  THEN 1 ELSE 0 END), 0)::int  AS failed_count,
          coalesce(sum(CASE WHEN ir.status = 'partial' THEN 1 ELSE 0 END), 0)::int  AS partial_count,
          max(ir.started_at)                                                          AS last_run_at,

          -- Açık alertler
          coalesce((
            SELECT count(*)::int
            FROM ingestion_alerts ia
            WHERE ia.province_id = p.id
              AND ia.resolved_at IS NULL
          ), 0)::int  AS alert_count,

          -- Kritik açık alertler
          coalesce((
            SELECT count(*)::int
            FROM ingestion_alerts ia
            WHERE ia.province_id = p.id
              AND ia.resolved_at IS NULL
              AND ia.severity    = 'critical'
          ), 0)::int  AS critical_alert_count,

          -- source_health: tazelik + seri hata bilgisi
          sh.last_success_at,
          sh.consecutive_failures,
          sh.last_pharmacy_count,
          sh.is_healthy,
          sh.last_district_fallback,

          -- 7 günlük trend (son 7 gündeki başarılı ingest pharmacy sayıları)
          (
            SELECT round(avg(upserted)::numeric, 1)
            FROM (
              SELECT
                (ir2.response_payload->>'upserted')::int AS upserted
              FROM ingestion_runs ir2
              JOIN source_endpoints se2 ON se2.id = ir2.source_endpoint_id
              JOIN sources          s2  ON s2.id  = se2.source_id
              WHERE s2.province_id  = p.id
                AND ir2.status      = 'success'
                AND ir2.started_at  > now() - interval '7 days'
              LIMIT 50
            ) sub
          )::float  AS avg_pharmacy_count_7d

        FROM provinces p
        LEFT JOIN sources          s   ON s.province_id   = p.id AND s.enabled = true
        LEFT JOIN source_endpoints se  ON se.source_id    = s.id AND se.is_primary = true AND se.enabled = true
        LEFT JOIN ingestion_runs   ir  ON ir.source_endpoint_id = se.id
          AND ir.started_at > now() - interval '24 hours'
        LEFT JOIN source_health    sh  ON sh.province_id  = p.id
        GROUP BY p.id, p.slug, p.name,
                 sh.last_success_at, sh.consecutive_failures,
                 sh.last_pharmacy_count, sh.is_healthy, sh.last_district_fallback
        ORDER BY p.slug
      `
    );

    const now = Date.now();

    return sendJson(
      res,
      200,
      rows.map((row) => {
        const lastSuccessAt  = row.last_success_at ? new Date(row.last_success_at) : null;
        const minutesSince   = lastSuccessAt ? Math.round((now - lastSuccessAt.getTime()) / 60000) : null;

        return {
          il:                   row.il,
          il_name:              row.il_name,
          success_count:        Number(row.success_count   || 0),
          failed_count:         Number(row.failed_count    || 0),
          partial_count:        Number(row.partial_count   || 0),
          last_run_at:          row.last_run_at ? new Date(row.last_run_at).toISOString() : null,
          alert_count:          Number(row.alert_count         || 0),
          critical_alert_count: Number(row.critical_alert_count || 0),

          // Tazelik
          freshness: {
            last_success_at:        lastSuccessAt ? lastSuccessAt.toISOString() : null,
            minutes_since_success:  minutesSince,
            is_stale:               minutesSince != null ? minutesSince > 130 : true,
            is_critical:            minutesSince != null ? minutesSince > 370 : false,
          },

          // Sağlık
          health: {
            is_healthy:             row.is_healthy ?? true,
            consecutive_failures:   Number(row.consecutive_failures || 0),
            last_pharmacy_count:    row.last_pharmacy_count != null ? Number(row.last_pharmacy_count) : null,
            avg_pharmacy_count_7d:  row.avg_pharmacy_count_7d != null ? Number(row.avg_pharmacy_count_7d) : null,
            district_fallback_count: Number(row.last_district_fallback || 0),
          },
        };
      })
    );
  } catch (error) {
    return sendInternalError(res, error);
  }
}
