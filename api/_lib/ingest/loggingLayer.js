/**
 * ingestion_runs logging helper — soft-fail.
 */
export async function logRun(sql, endpointId, status, httpStatus, errorMsg) {
  try {
    await sql`
      INSERT INTO ingestion_runs
        (source_endpoint_id, status, finished_at, http_status, error_message)
      VALUES
        (${endpointId}, ${status}::run_status, now(), ${httpStatus ?? null}, ${errorMsg ?? null})
    `;
  } catch (err) {
    console.error("[ingest] logRun failed:", err.message);
  }
}

/**
 * ingestion_alerts logger — alert_type examples:
 * no_data, partial_data, parse_error, timeout, mismatch_count
 */
const provinceBySlugCache = new Map();
const provinceByEndpointCache = new Map();

export async function logAlert(sql, {
  provinceId = null,
  ilSlug = null,
  endpointId = null,
  alertType,
  severity = "medium",
  message = null,
  payload = null
}) {
  try {
    const resolvedProvinceId = await resolveProvinceId(sql, { provinceId, ilSlug, endpointId });
    if (!resolvedProvinceId) {
      console.error("[ingest] logAlert skipped: province_id unresolved", { ilSlug, endpointId, alertType });
      return;
    }

    const safeMessage = String(message ?? "").trim() || String(alertType || "ingestion_alert");
    const safeSeverity = normalizeSeverity(severity);
    const safePayload =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload
        : payload == null
          ? {}
          : { value: payload };

    await sql`
      INSERT INTO ingestion_alerts
        (province_id, source_endpoint_id, alert_type, severity, message, payload, created_at)
      VALUES
        (
          ${resolvedProvinceId},
          ${endpointId ?? null},
          ${alertType},
          ${safeSeverity},
          ${safeMessage},
          ${JSON.stringify(safePayload)}::jsonb,
          now()
        )
    `;
  } catch (err) {
    console.error("[ingest] logAlert failed:", err.message);
  }
}

async function resolveProvinceId(sql, { provinceId, ilSlug, endpointId }) {
  if (Number.isInteger(provinceId) && provinceId > 0) return provinceId;

  if (ilSlug) {
    const slug = String(ilSlug).toLowerCase();
    if (provinceBySlugCache.has(slug)) {
      return provinceBySlugCache.get(slug);
    }
    const rows = await sql`
      SELECT id
      FROM provinces
      WHERE slug = ${slug}
      LIMIT 1
    `;
    const id = rows[0]?.id ? Number(rows[0].id) : null;
    if (id) provinceBySlugCache.set(slug, id);
    if (id) return id;
  }

  if (Number.isInteger(endpointId) && endpointId > 0) {
    if (provinceByEndpointCache.has(endpointId)) {
      return provinceByEndpointCache.get(endpointId);
    }
    const rows = await sql`
      SELECT s.province_id
      FROM source_endpoints se
      JOIN sources s ON s.id = se.source_id
      WHERE se.id = ${endpointId}
      LIMIT 1
    `;
    const id = rows[0]?.province_id ? Number(rows[0].province_id) : null;
    if (id) provinceByEndpointCache.set(endpointId, id);
    if (id) return id;
  }

  return null;
}

function normalizeSeverity(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "critical" || s === "warning" || s === "info") return s;
  if (s === "high") return "critical";
  if (s === "medium") return "warning";
  if (s === "low") return "info";
  return "warning";
}

/**
 * source_health tablosunu günceller — soft-fail.
 *
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 * @param {{
 *   provinceId: number,
 *   endpointId: number|null,
 *   status: "success"|"failed"|"partial"|string,
 *   pharmacyCount?: number,
 *   failureReason?: string|null,
 *   districtResolution?: { exact?:number, normalized?:number, alias?:number, fuzzy?:number, fallback?:number }
 * }} params
 */
export async function updateSourceHealth(sql, {
  provinceId,
  endpointId = null,
  status,
  pharmacyCount = null,
  failureReason = null,
  districtResolution = {},
}) {
  try {
    const isSuccess      = status === "success" || status === "partial";
    const isFailure      = !isSuccess;
    const dr             = districtResolution || {};

    if (isSuccess) {
      await sql`
        INSERT INTO source_health (
          province_id, endpoint_id,
          last_success_at, last_attempt_at,
          consecutive_failures, last_failure_reason,
          last_pharmacy_count,
          last_district_exact, last_district_normalized, last_district_alias,
          last_district_fuzzy,  last_district_fallback,
          is_healthy, health_updated_at, updated_at
        )
        VALUES (
          ${provinceId}, ${endpointId ?? null},
          now(), now(),
          0, null,
          ${pharmacyCount ?? null},
          ${dr.exact    ?? 0}, ${dr.normalized ?? 0}, ${dr.alias ?? 0},
          ${dr.fuzzy    ?? 0}, ${dr.fallback   ?? 0},
          true, now(), now()
        )
        ON CONFLICT (province_id) DO UPDATE SET
          endpoint_id               = EXCLUDED.endpoint_id,
          last_success_at           = EXCLUDED.last_success_at,
          last_attempt_at           = EXCLUDED.last_attempt_at,
          consecutive_failures      = 0,
          last_failure_reason       = null,
          last_pharmacy_count       = EXCLUDED.last_pharmacy_count,
          last_district_exact       = EXCLUDED.last_district_exact,
          last_district_normalized  = EXCLUDED.last_district_normalized,
          last_district_alias       = EXCLUDED.last_district_alias,
          last_district_fuzzy       = EXCLUDED.last_district_fuzzy,
          last_district_fallback    = EXCLUDED.last_district_fallback,
          is_healthy                = true,
          health_updated_at         = now(),
          updated_at                = now()
      `;
    } else {
      // Başarısız ingest: consecutive_failures artır, eşiği geçince is_healthy=false
      await sql`
        INSERT INTO source_health (
          province_id, endpoint_id,
          last_attempt_at, consecutive_failures, last_failure_reason,
          is_healthy, health_updated_at, updated_at
        )
        VALUES (
          ${provinceId}, ${endpointId ?? null},
          now(), 1, ${failureReason ?? null},
          false, now(), now()
        )
        ON CONFLICT (province_id) DO UPDATE SET
          endpoint_id          = EXCLUDED.endpoint_id,
          last_attempt_at      = EXCLUDED.last_attempt_at,
          consecutive_failures = source_health.consecutive_failures + 1,
          last_failure_reason  = EXCLUDED.last_failure_reason,
          is_healthy           = CASE
            WHEN source_health.consecutive_failures + 1 >= 3 THEN false
            ELSE source_health.is_healthy
          END,
          health_updated_at    = now(),
          updated_at           = now()
      `;
    }
  } catch (err) {
    console.error("[ingest] updateSourceHealth failed:", err.message);
  }
}
