/**
 * Admin catch-all — tüm admin endpoint'lerini tek bir Function'da toplar.
 * (Vercel Hobby plan: maks 12 function limiti)
 *
 * Yönlendirilen path'ler:
 *   GET  /api/admin/freshness
 *   GET  /api/admin/ingestion/overview
 *   GET  /api/admin/ingestion/alerts/open
 *   POST /api/admin/ingestion/alerts/:id/resolve
 *
 * NOT: /api/admin/ingestion/recovery/[il]/trigger ayrı dosyada kalır
 *      (maxDuration: 30 saniye gereksinimi nedeniyle).
 */
import { withDb } from "../_lib/db.js";
import { getSingleQueryValue, methodNotAllowed, requireAdmin, sendInternalError, sendJson } from "../_lib/http.js";
import { checkRateLimit } from "../_lib/security.js";
import { logAdminAction } from "../_lib/adminAudit.js";

const STALE_WARNING_MINUTES  = 130;
const STALE_CRITICAL_MINUTES = 370;

// ─── GET /api/admin/freshness ─────────────────────────────────────────────────

async function handleFreshness(req, res) {
  if (req.method !== "GET") return methodNotAllowed(req, res, ["GET"]);

  const rows = await withDb((db) => db`
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
    FROM provinces p
    LEFT JOIN source_health sh ON sh.province_id = p.id
    ORDER BY
      CASE
        WHEN sh.last_success_at IS NULL THEN 0
        WHEN extract(epoch FROM (now() - sh.last_success_at)) / 60.0 > ${STALE_CRITICAL_MINUTES} THEN 1
        WHEN extract(epoch FROM (now() - sh.last_success_at)) / 60.0 > ${STALE_WARNING_MINUTES}  THEN 2
        ELSE 3
      END,
      p.slug
  `);

  const now = Date.now();
  let healthy = 0, staleWarning = 0, staleCritical = 0, neverUpdated = 0;

  const provinces = rows.map((row) => {
    const minutes     = row.minutes_since_success != null ? Number(row.minutes_since_success) : null;
    const lastSuccess = row.last_success_at ? new Date(row.last_success_at).toISOString() : null;

    let freshnessStatus;
    if (minutes == null)                       { freshnessStatus = "never_updated"; neverUpdated++; }
    else if (minutes > STALE_CRITICAL_MINUTES) { freshnessStatus = "critical";      staleCritical++; }
    else if (minutes > STALE_WARNING_MINUTES)  { freshnessStatus = "warning";       staleWarning++;  }
    else                                       { freshnessStatus = "ok";            healthy++;       }

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
    thresholds: { warning_minutes: STALE_WARNING_MINUTES, critical_minutes: STALE_CRITICAL_MINUTES },
    summary: { total: rows.length, healthy, stale_warning: staleWarning, stale_critical: staleCritical, never_updated: neverUpdated },
    provinces,
  });
}

// ─── GET /api/admin/ingestion/overview ────────────────────────────────────────

async function handleOverview(req, res) {
  if (req.method !== "GET") return methodNotAllowed(req, res, ["GET"]);

  const rows = await withDb((db) => db`
    SELECT
      p.slug                AS il,
      p.name                AS il_name,
      coalesce(sum(CASE WHEN ir.status = 'success' THEN 1 ELSE 0 END), 0)::int  AS success_count,
      coalesce(sum(CASE WHEN ir.status = 'failed'  THEN 1 ELSE 0 END), 0)::int  AS failed_count,
      coalesce(sum(CASE WHEN ir.status = 'partial' THEN 1 ELSE 0 END), 0)::int  AS partial_count,
      max(ir.started_at)                                                          AS last_run_at,
      coalesce((
        SELECT count(*)::int FROM ingestion_alerts ia
        WHERE ia.province_id = p.id AND ia.resolved_at IS NULL
      ), 0)::int  AS alert_count,
      coalesce((
        SELECT count(*)::int FROM ingestion_alerts ia
        WHERE ia.province_id = p.id AND ia.resolved_at IS NULL AND ia.severity = 'critical'
      ), 0)::int  AS critical_alert_count,
      sh.last_success_at,
      sh.consecutive_failures,
      sh.last_pharmacy_count,
      sh.is_healthy,
      sh.last_district_fallback,
      (
        SELECT round(avg(upserted)::numeric, 1)
        FROM (
          SELECT (ir2.response_payload->>'upserted')::int AS upserted
          FROM ingestion_runs ir2
          JOIN source_endpoints se2 ON se2.id = ir2.source_endpoint_id
          JOIN sources          s2  ON s2.id  = se2.source_id
          WHERE s2.province_id = p.id AND ir2.status = 'success'
            AND ir2.started_at > now() - interval '7 days'
          LIMIT 50
        ) sub
      )::float  AS avg_pharmacy_count_7d
    FROM provinces p
    LEFT JOIN sources          s   ON s.province_id = p.id AND s.enabled = true
    LEFT JOIN source_endpoints se  ON se.source_id  = s.id AND se.is_primary = true AND se.enabled = true
    LEFT JOIN ingestion_runs   ir  ON ir.source_endpoint_id = se.id
      AND ir.started_at > now() - interval '24 hours'
    LEFT JOIN source_health    sh  ON sh.province_id = p.id
    GROUP BY p.id, p.slug, p.name,
             sh.last_success_at, sh.consecutive_failures,
             sh.last_pharmacy_count, sh.is_healthy, sh.last_district_fallback
    ORDER BY p.slug
  `);

  const now = Date.now();
  return sendJson(res, 200, rows.map((row) => {
    const lastSuccessAt = row.last_success_at ? new Date(row.last_success_at) : null;
    const minutesSince  = lastSuccessAt ? Math.round((now - lastSuccessAt.getTime()) / 60000) : null;
    return {
      il:                   row.il,
      il_name:              row.il_name,
      success_count:        Number(row.success_count   || 0),
      failed_count:         Number(row.failed_count    || 0),
      partial_count:        Number(row.partial_count   || 0),
      last_run_at:          row.last_run_at ? new Date(row.last_run_at).toISOString() : null,
      alert_count:          Number(row.alert_count         || 0),
      critical_alert_count: Number(row.critical_alert_count || 0),
      freshness: {
        last_success_at:       lastSuccessAt ? lastSuccessAt.toISOString() : null,
        minutes_since_success: minutesSince,
        is_stale:              minutesSince != null ? minutesSince > 130 : true,
        is_critical:           minutesSince != null ? minutesSince > 370 : false,
      },
      health: {
        is_healthy:             row.is_healthy ?? true,
        consecutive_failures:   Number(row.consecutive_failures || 0),
        last_pharmacy_count:    row.last_pharmacy_count != null ? Number(row.last_pharmacy_count) : null,
        avg_pharmacy_count_7d:  row.avg_pharmacy_count_7d != null ? Number(row.avg_pharmacy_count_7d) : null,
        district_fallback_count: Number(row.last_district_fallback || 0),
      },
    };
  }));
}

// ─── GET /api/admin/ingestion/alerts/open ─────────────────────────────────────

async function handleAlertsOpen(req, res) {
  if (req.method !== "GET") return methodNotAllowed(req, res, ["GET"]);

  const rows = await withDb((db) => db`
    select
      ia.id,
      p.slug as il,
      ia.source_endpoint_id,
      ia.alert_type,
      ia.severity,
      ia.message,
      ia.payload,
      ia.created_at
    from ingestion_alerts ia
    join provinces p on p.id = ia.province_id
    where ia.resolved_at is null
    order by ia.created_at desc
    limit 200
  `);

  return sendJson(res, 200, rows.map((row) => ({
    id:                 Number(row.id),
    il:                 row.il,
    source_endpoint_id: row.source_endpoint_id === null ? null : Number(row.source_endpoint_id),
    alert_type:         row.alert_type,
    severity:           row.severity,
    message:            row.message,
    payload:            row.payload ?? null,
    created_at:         new Date(row.created_at).toISOString(),
  })));
}

// ─── POST /api/admin/ingestion/alerts/:id/resolve ─────────────────────────────

async function handleAlertResolve(req, res, alertId) {
  if (req.method !== "POST") return methodNotAllowed(req, res, ["POST"]);

  if (!Number.isInteger(alertId) || alertId <= 0) {
    return sendJson(res, 400, { error: "invalid_alert_id" });
  }

  const { parseJsonBody } = await import("../_lib/http.js");
  const body       = await parseJsonBody(req);
  const resolvedBy = String(body.resolved_by || "admin").slice(0, 64);

  const rows = await withDb(async (db) => {
    const updated = await db`
      update ingestion_alerts
      set
        resolved_at = now(),
        payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('resolved_by', ${resolvedBy})
      where id = ${alertId}
        and resolved_at is null
      returning id
    `;

    if (updated.length > 0) {
      await logAdminAction(db, req, {
        action:       "alert.resolve",
        actor:        resolvedBy,
        resourceType: "alert",
        resourceId:   String(alertId),
      });
    }
    return updated;
  });

  return sendJson(res, 200, { resolved: rows.length > 0, id: alertId });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (!await checkRateLimit(req, res)) return;
  if (!requireAdmin(req, res)) return;

  // req.url: "/api/admin/freshness" ya da başında olmayabilir
  const rawPath = (req.url || "").split("?")[0].toLowerCase();

  try {
    // GET /api/admin/freshness
    if (rawPath.endsWith("/freshness")) {
      return await handleFreshness(req, res);
    }

    // GET /api/admin/ingestion/overview
    if (rawPath.includes("/ingestion/overview")) {
      return await handleOverview(req, res);
    }

    // GET /api/admin/ingestion/alerts/open
    if (rawPath.includes("/ingestion/alerts/open")) {
      return await handleAlertsOpen(req, res);
    }

    // POST /api/admin/ingestion/alerts/:id/resolve
    const resolveMatch = rawPath.match(/\/ingestion\/alerts\/(\d+)\/resolve/);
    if (resolveMatch) {
      return await handleAlertResolve(req, res, Number(resolveMatch[1]));
    }

    return sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    return sendInternalError(res, error);
  }
}
