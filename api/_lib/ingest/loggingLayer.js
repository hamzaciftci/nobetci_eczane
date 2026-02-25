/**
 * ingestion_runs logging helper — soft-fail.
 */
export async function logRun(sql, endpointId, status, httpStatus, errorMsg, ilSlug = null) {
  try {
    await sql`
      INSERT INTO ingestion_runs
        (source_endpoint_id, il_slug, status, finished_at, http_status, error_message)
      VALUES
        (${endpointId}, ${ilSlug ?? null}, ${status}::run_status, now(), ${httpStatus ?? null}, ${errorMsg ?? null})
    `;
  } catch (err) {
    console.error("[ingest] logRun failed:", err.message);
  }
}

/**
 * ingestion_alerts logger — alert_type examples:
 * no_data, partial_data, parse_error, timeout, mismatch_count
 */
export async function logAlert(sql, { ilSlug, endpointId, alertType, severity = "medium", message = null, payload = null }) {
  try {
    await sql`
      INSERT INTO ingestion_alerts
        (il_slug, source_endpoint_id, alert_type, severity, message, payload, created_at)
      VALUES
        (${ilSlug}, ${endpointId ?? null}, ${alertType}, ${severity}, ${message ?? null}, ${payload ? JSON.stringify(payload) : null}::jsonb, now())
    `;
  } catch (err) {
    console.error("[ingest] logAlert failed:", err.message);
  }
}
