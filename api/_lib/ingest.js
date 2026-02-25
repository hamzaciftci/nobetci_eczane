/**
 * Orchestration layer for duty ingestion.
 * Splits concerns into fetch/parser/normalize/upsert/logging layers.
 */
import { fetchIstanbulRows, fetchResource } from "./ingest/fetchLayer.js";
import { detectAjaxApiUrl, parseHtmlPharmacies, parseJsonPharmacies } from "./ingest/parserLayer.js";
import { upsertRows } from "./ingest/upsertLayer.js";
import { logRun, logAlert } from "./ingest/loggingLayer.js";

// Tune together with FETCH_TIMEOUT_MS (see fetchLayer).
// Province timeout must be slightly higher than fetch timeout to allow one fetch + parse.
export const PROVINCE_TIMEOUT_MS = 12_000;
export const BATCH_SIZE = 25;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error(`province_timeout_${ms}ms:${label}`)), ms)
    )
  ]);
}

/**
 * Ingest duty pharmacies for a single province.
 * @returns {Promise<{status, il, found, upserted, elapsed_ms, error?}>}
 */
export async function ingestProvince(sql, ilSlug) {
  const started = Date.now();

  const eps = await sql`
    SELECT
      se.id           AS endpoint_id,
      se.endpoint_url,
      se.parser_key,
      se.format,
      se.source_id,
      s.province_id,
      p.name          AS province_name
    FROM source_endpoints se
    JOIN sources   s ON s.id = se.source_id
    JOIN provinces p ON p.id = s.province_id
    WHERE p.slug        = ${ilSlug}
      AND se.enabled    = true
      AND se.is_primary = true
    LIMIT 1
  `;

  if (!eps.length) {
    return { status: "no_endpoint", il: ilSlug, found: 0, upserted: 0, elapsed_ms: Date.now() - started };
  }

  const ep = eps[0];

  // Istanbul/Yalova special flow
  if (ep.parser_key === "istanbul_secondary_v1") {
    const { rows, httpStatus, error } = await fetchIstanbulRows(ep.endpoint_url, ilSlug);
    if (error && !rows.length) {
      await logRun(sql, ep.endpoint_id, "failed", httpStatus ?? null, error, ilSlug);
      await logAlert(sql, { ilSlug, endpointId: ep.endpoint_id, alertType: "fetch_error", severity: "high", message: error });
      return { status: "fetch_error", il: ilSlug, found: 0, upserted: 0, error, elapsed_ms: Date.now() - started };
    }
    if (!rows.length) {
      await logRun(sql, ep.endpoint_id, "partial", httpStatus ?? null, "no_pharmacies_after_filter", ilSlug);
      await logAlert(sql, { ilSlug, endpointId: ep.endpoint_id, alertType: "no_data", severity: "high", message: "istanbul_flow_no_rows" });
      return { status: "no_data", il: ilSlug, found: 0, upserted: 0, elapsed_ms: Date.now() - started };
    }
    const result = await upsertRows(sql, ep, ilSlug, rows, httpStatus, started);
    await postIngestAlerts(sql, ep, result);
    logStructured(ep.slug ?? ilSlug, result);
    return result;
  }

  let html = null;
  let jsonData = null;
  let httpStatus = null;

  try {
    const result = await fetchResource(ep.endpoint_url);
    httpStatus = result.status;
    if (ep.format === "api" || ep.parser_key === "generic_api_v1") {
      jsonData = result.json;
    } else {
      html = result.html;
    }
  } catch (err) {
    await logRun(sql, ep.endpoint_id, "failed", httpStatus, err.message, ilSlug);
    await logAlert(sql, { ilSlug, endpointId: ep.endpoint_id, alertType: "fetch_error", severity: "high", message: err.message });
    return { status: "fetch_error", il: ilSlug, found: 0, upserted: 0, error: err.message, elapsed_ms: Date.now() - started };
  }

  let rows;
  try {
    if (jsonData !== null) {
      rows = parseJsonPharmacies(jsonData, ep.parser_key);
    } else {
      rows = parseHtmlPharmacies(html, ep.parser_key);
      if (rows.length === 0) {
        const ajaxUrl = detectAjaxApiUrl(html, ep.endpoint_url);
        if (ajaxUrl) {
          const apiResult = await fetchResource(ajaxUrl);
          const apiHtml = apiResult.html;
          if (apiHtml) rows = parseHtmlPharmacies(apiHtml, ep.parser_key);
        }
      }
    }
  } catch (err) {
    await logRun(sql, ep.endpoint_id, "partial", httpStatus, `parse_error: ${err.message}`, ilSlug);
    await logAlert(sql, { ilSlug, endpointId: ep.endpoint_id, alertType: "parse_error", severity: "medium", message: err.message });
    return { status: "parse_error", il: ilSlug, found: 0, upserted: 0, error: err.message, elapsed_ms: Date.now() - started };
  }

  if (!rows.length) {
    await logRun(sql, ep.endpoint_id, "partial", httpStatus, "no_pharmacies_parsed", ilSlug);
    await logAlert(sql, { ilSlug, endpointId: ep.endpoint_id, alertType: "no_data", severity: "high", message: "no_pharmacies_parsed" });
    return { status: "no_data", il: ilSlug, found: 0, upserted: 0, elapsed_ms: Date.now() - started };
  }

  const result = await upsertRows(sql, ep, ilSlug, rows, httpStatus, started);
  await postIngestAlerts(sql, ep, result);
  logStructured(ep.slug ?? ilSlug, result);
  return result;
}

export { withTimeout };

async function postIngestAlerts(sql, ep, result) {
  const ilSlug = result.il;
  if (result.status === "partial") {
    await logAlert(sql, { ilSlug, endpointId: ep.endpoint_id, alertType: "partial_data", severity: "medium", message: result.errors?.join("; ") ?? "partial_ingest" });
  }
  if (result.status === "no_data" || result.upserted === 0) {
    await logAlert(sql, { ilSlug, endpointId: ep.endpoint_id, alertType: "no_data", severity: "high", message: "no_records_upserted" });
  }
  if (typeof result.expected_count === "number" && typeof result.covered_districts === "number" && result.expected_count > 0) {
    const coverage = result.covered_districts / result.expected_count;
    if (coverage < 0.8) {
      await logAlert(sql, {
        ilSlug,
        endpointId: ep.endpoint_id,
        alertType: "mismatch_count",
        severity: coverage < 0.5 ? "high" : "medium",
        message: `coverage ${result.covered_districts}/${result.expected_count}`,
        payload: { expected: result.expected_count, actual: result.covered_districts }
      });
    }
  }
}

function logStructured(ilSlug, result) {
  try {
    console.log(
      JSON.stringify({
        scope: "ingest_province",
        il: ilSlug,
        status: result.status,
        found: result.found,
        upserted: result.upserted,
        expected: result.expected_count,
        covered: result.covered_districts,
        elapsed_ms: result.elapsed_ms
      })
    );
  } catch {
    /* ignore */
  }
}
