/**
 * Orchestration layer for duty ingestion.
 * Splits concerns into fetch/parser/normalize/upsert/logging layers.
 */
import {
  fetchAnkaraRows,
  fetchDutyFormHtml,
  fetchIstanbulRows,
  fetchOrduRows,
  fetchOsmaniyeHtml,
  fetchResource,
  fetchUsakRows
} from "./ingest/fetchLayer.js";
import { detectAjaxApiUrl, parseHtmlPharmacies, parseJsonPharmacies } from "./ingest/parserLayer.js";
// Parser registry — keyed + auto-detect dispatch (if-else chain yerine)
import { parserRegistry } from "./parsers/index.js";
import { upsertRows } from "./ingest/upsertLayer.js";
import { logRun, logAlert, updateSourceHealth } from "./ingest/loggingLayer.js";
import { resolveActiveDutyDate } from "./time.js";
import { getProvinceSourceConfig } from "./provinceSources.js";
import { classifyNameDiff, diffSeverity } from "./verifyDiff.js";

// Tune together with FETCH_TIMEOUT_MS (see fetchLayer).
// Province timeout must be slightly higher than fetch timeout to allow one fetch + parse.
export const PROVINCE_TIMEOUT_MS = 12_000;
export const BATCH_SIZE = 25;
const DUTY_FORM_FALLBACK_PARSER_KEYS = new Set([
  // Opt-in only. Keep empty by default to avoid cross-province false positives.
  // Provinces with mandatory form-submit should use dedicated flows above.
]);

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
  const cfg = getProvinceSourceConfig(ilSlug);
  const preferredEndpointUrl = cfg?.officialSourceUrl ?? "";
  const preferredSourceName = cfg?.sourceName ?? "";

  const eps = await sql`
    SELECT
      se.id           AS endpoint_id,
      se.endpoint_url,
      se.parser_key,
      se.format,
      se.source_id,
      s.province_id,
      s.name          AS source_name,
      s.authority_weight,
      p.name          AS province_name
    FROM source_endpoints se
    JOIN sources   s ON s.id = se.source_id
    JOIN provinces p ON p.id = s.province_id
    WHERE p.slug        = ${ilSlug}
      AND se.enabled    = true
      AND se.is_primary = true
    ORDER BY
      CASE WHEN se.endpoint_url = ${preferredEndpointUrl} THEN 0 ELSE 1 END,
      CASE WHEN s.name = ${preferredSourceName} THEN 0 ELSE 1 END,
      s.authority_weight DESC,
      se.id ASC
    LIMIT 1
  `;

  if (!eps.length) {
    return { status: "no_endpoint", il: ilSlug, found: 0, upserted: 0, elapsed_ms: Date.now() - started };
  }

  let ep = eps[0];
  ep = await applyCatalogOverrides(sql, ep, ilSlug, cfg);

  // Ankara aeo.org.tr getPharmacies AJAX flow
  if (ep.parser_key === "ankara_ajax_v1") {
    const { rows, httpStatus, error } = await fetchAnkaraRows(ep.endpoint_url);
    if (error && !rows.length) {
      await logRun(sql, ep.endpoint_id, "failed", httpStatus ?? null, error);
      await logAlert(sql, { ilSlug, provinceId: ep.province_id, endpointId: ep.endpoint_id, alertType: "fetch_error", severity: "high", message: error });
      return { status: "fetch_error", il: ilSlug, found: 0, upserted: 0, error, elapsed_ms: Date.now() - started };
    }
    if (!rows.length) {
      await logRun(sql, ep.endpoint_id, "partial", httpStatus ?? null, "no_pharmacies_in_ajax");
      await logAlert(sql, { ilSlug, provinceId: ep.province_id, endpointId: ep.endpoint_id, alertType: "no_data", severity: "high", message: "ankara_ajax_no_rows" });
      return { status: "no_data", il: ilSlug, found: 0, upserted: 0, elapsed_ms: Date.now() - started };
    }
    return finalizeSuccessfulIngest(sql, ep, ilSlug, rows, httpStatus, started);
  }

  // Ordu eczanesistemi.net multi-iframe flow
  if (ep.parser_key === "eczanesistemi_iframe_v1") {
    const { rows, httpStatus, error } = await fetchOrduRows(ep.endpoint_url);
    if (error && !rows.length) {
      await logRun(sql, ep.endpoint_id, "failed", httpStatus ?? null, error);
      await logAlert(sql, { ilSlug, provinceId: ep.province_id, endpointId: ep.endpoint_id, alertType: "fetch_error", severity: "high", message: error });
      return { status: "fetch_error", il: ilSlug, found: 0, upserted: 0, error, elapsed_ms: Date.now() - started };
    }
    if (!rows.length) {
      await logRun(sql, ep.endpoint_id, "partial", httpStatus ?? null, "no_pharmacies_in_iframes");
      await logAlert(sql, { ilSlug, provinceId: ep.province_id, endpointId: ep.endpoint_id, alertType: "no_data", severity: "high", message: "ordu_flow_no_rows" });
      return { status: "no_data", il: ilSlug, found: 0, upserted: 0, elapsed_ms: Date.now() - started };
    }
    return finalizeSuccessfulIngest(sql, ep, ilSlug, rows, httpStatus, started);
  }

  // Istanbul/Yalova special flow
  if (ep.parser_key === "istanbul_secondary_v1") {
    const { rows, httpStatus, error } = await fetchIstanbulRows(ep.endpoint_url, ilSlug);
    if (error && !rows.length) {
      await logRun(sql, ep.endpoint_id, "failed", httpStatus ?? null, error);
      await logAlert(sql, { ilSlug, provinceId: ep.province_id, endpointId: ep.endpoint_id, alertType: "fetch_error", severity: "high", message: error });
      return { status: "fetch_error", il: ilSlug, found: 0, upserted: 0, error, elapsed_ms: Date.now() - started };
    }
    if (!rows.length) {
      await logRun(sql, ep.endpoint_id, "partial", httpStatus ?? null, "no_pharmacies_after_filter");
      await logAlert(sql, { ilSlug, provinceId: ep.province_id, endpointId: ep.endpoint_id, alertType: "no_data", severity: "high", message: "istanbul_flow_no_rows" });
      return { status: "no_data", il: ilSlug, found: 0, upserted: 0, elapsed_ms: Date.now() - started };
    }
    return finalizeSuccessfulIngest(sql, ep, ilSlug, rows, httpStatus, started);
  }

  // Uşak usakeczaciodasi.org.tr AJAX flow
  if (ep.parser_key === "usak_ajax_v1") {
    const { rows, httpStatus, error } = await fetchUsakRows(ep.endpoint_url);
    if (error && !rows.length) {
      await logRun(sql, ep.endpoint_id, "failed", httpStatus ?? null, error);
      await logAlert(sql, {
        ilSlug,
        provinceId: ep.province_id,
        endpointId: ep.endpoint_id,
        alertType: "fetch_error",
        severity: "high",
        message: error
      });
      return { status: "fetch_error", il: ilSlug, found: 0, upserted: 0, error, elapsed_ms: Date.now() - started };
    }
    if (!rows.length) {
      await logRun(sql, ep.endpoint_id, "partial", httpStatus ?? null, "usak_flow_no_rows");
      await logAlert(sql, {
        ilSlug,
        provinceId: ep.province_id,
        endpointId: ep.endpoint_id,
        alertType: "no_data",
        severity: "high",
        message: "usak_flow_no_rows"
      });
      return { status: "no_data", il: ilSlug, found: 0, upserted: 0, elapsed_ms: Date.now() - started };
    }
    return finalizeSuccessfulIngest(sql, ep, ilSlug, rows, httpStatus, started);
  }

  // Osmaniye Eczacı Odası POST form flow
  if (ep.parser_key === "osmaniye_eo_v1") {
    const { html: postHtml, httpStatus, error } = await fetchOsmaniyeHtml(ep.endpoint_url);
    if (error && !postHtml) {
      await logRun(sql, ep.endpoint_id, "failed", httpStatus ?? null, error);
      await logAlert(sql, {
        ilSlug,
        provinceId: ep.province_id,
        endpointId: ep.endpoint_id,
        alertType: "fetch_error",
        severity: "high",
        message: error
      });
      return { status: "fetch_error", il: ilSlug, found: 0, upserted: 0, error, elapsed_ms: Date.now() - started };
    }

    let rows = [];
    try {
      rows = parseHtmlPharmacies(postHtml, ep.parser_key);
    } catch (err) {
      await logRun(sql, ep.endpoint_id, "partial", httpStatus ?? null, `parse_error: ${err.message}`);
      await logAlert(sql, {
        ilSlug,
        provinceId: ep.province_id,
        endpointId: ep.endpoint_id,
        alertType: "parse_error",
        severity: "high",
        message: err.message
      });
      return { status: "parse_error", il: ilSlug, found: 0, upserted: 0, error: err.message, elapsed_ms: Date.now() - started };
    }

    if (!rows.length) {
      await logRun(sql, ep.endpoint_id, "partial", httpStatus ?? null, "osmaniye_post_no_rows");
      await logAlert(sql, {
        ilSlug,
        provinceId: ep.province_id,
        endpointId: ep.endpoint_id,
        alertType: "no_data",
        severity: "high",
        message: "osmaniye_post_no_rows"
      });
      return { status: "no_data", il: ilSlug, found: 0, upserted: 0, elapsed_ms: Date.now() - started };
    }

    return finalizeSuccessfulIngest(sql, ep, ilSlug, rows, httpStatus ?? null, started);
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
    await logRun(sql, ep.endpoint_id, "failed", httpStatus, err.message);
    await logAlert(sql, { ilSlug, provinceId: ep.province_id, endpointId: ep.endpoint_id, alertType: "fetch_error", severity: "high", message: err.message });
    return { status: "fetch_error", il: ilSlug, found: 0, upserted: 0, error: err.message, elapsed_ms: Date.now() - started };
  }

  let rows;
  try {
    if (jsonData !== null) {
      rows = parseJsonPharmacies(jsonData, ep.parser_key);
    } else {
      // Parser Registry dispatch: keyed parser → auto-detect fallback
      const { rows: registryRows, strategy } = parserRegistry.dispatch(ep.parser_key, html);
      rows = registryRows;

      // Registry başarısız olursa eski parserLayer'a son şans (backward compat)
      if (!rows.length) {
        rows = parseHtmlPharmacies(html, ep.parser_key);
      }

      if (DUTY_FORM_FALLBACK_PARSER_KEYS.has(ep.parser_key)) {
        const formResult = await fetchDutyFormHtml(ep.endpoint_url, html);
        if (formResult.usedForm && !formResult.error && formResult.html) {
          const { rows: formRows } = parserRegistry.dispatch(ep.parser_key, formResult.html);
          if (formRows.length > 0) {
            rows = formRows;
            httpStatus = formResult.httpStatus ?? httpStatus;
          }
        }
      }

      if (rows.length === 0) {
        const ajaxUrl = detectAjaxApiUrl(html, ep.endpoint_url);
        if (ajaxUrl) {
          const apiResult = await fetchResource(ajaxUrl);
          if (apiResult.html) {
            const { rows: ajaxRows } = parserRegistry.dispatch(ep.parser_key, apiResult.html);
            rows = ajaxRows.length ? ajaxRows : parseHtmlPharmacies(apiResult.html, ep.parser_key);
          }
        }
      }

      // Parse stratejisini logla (debug için faydalı)
      if (strategy && strategy !== "no_match") {
        console.log(JSON.stringify({ scope: "parser_dispatch", il: ilSlug, parser_key: ep.parser_key, strategy }));
      }
    }
  } catch (err) {
    await logRun(sql, ep.endpoint_id, "partial", httpStatus, `parse_error: ${err.message}`);
    await logAlert(sql, { ilSlug, provinceId: ep.province_id, endpointId: ep.endpoint_id, alertType: "parse_error", severity: "medium", message: err.message });
    return { status: "parse_error", il: ilSlug, found: 0, upserted: 0, error: err.message, elapsed_ms: Date.now() - started };
  }

  if (!rows.length) {
    await logRun(sql, ep.endpoint_id, "partial", httpStatus, "no_pharmacies_parsed");
    await logAlert(sql, { ilSlug, provinceId: ep.province_id, endpointId: ep.endpoint_id, alertType: "no_data", severity: "high", message: "no_pharmacies_parsed" });
    return { status: "no_data", il: ilSlug, found: 0, upserted: 0, elapsed_ms: Date.now() - started };
  }

  return finalizeSuccessfulIngest(sql, ep, ilSlug, rows, httpStatus, started);
}

async function finalizeSuccessfulIngest(sql, ep, ilSlug, rows, httpStatus, started) {
  const result = await upsertRows(sql, ep, ilSlug, rows, httpStatus, started);
  await postIngestAlerts(sql, ep, result);
  const verification = await postIngestVerification(sql, ep, ilSlug, rows);
  if (verification) {
    result.verification = verification;
  }

  // source_health güncelle (soft-fail, asla ingest'i engellemez)
  await updateSourceHealth(sql, {
    provinceId:        ep.province_id,
    endpointId:        ep.endpoint_id,
    status:            result.status,
    pharmacyCount:     result.upserted,
    failureReason:     result.errors?.[0] ?? null,
    districtResolution: result.district_resolution ?? {},
  });
  logStructured(ep.slug ?? ilSlug, result);
  return result;
}

export { withTimeout };

async function postIngestAlerts(sql, ep, result) {
  const ilSlug = result.il;
  if (result.status === "partial") {
    await logAlert(sql, {
      ilSlug,
      provinceId: ep.province_id,
      endpointId: ep.endpoint_id,
      alertType: "partial_data",
      severity: "medium",
      message: result.errors?.join("; ") ?? "partial_ingest"
    });
  }
  if (result.status === "no_data" || result.upserted === 0) {
    await logAlert(sql, {
      ilSlug,
      provinceId: ep.province_id,
      endpointId: ep.endpoint_id,
      alertType: "no_data",
      severity: "high",
      message: "no_records_upserted"
    });
  }
  if (typeof result.expected_count === "number" && typeof result.covered_districts === "number" && result.expected_count > 0) {
    const coverage = result.covered_districts / result.expected_count;
    if (coverage < 0.8) {
      await logAlert(sql, {
        ilSlug,
        provinceId: ep.province_id,
        endpointId: ep.endpoint_id,
        alertType: "mismatch_count",
        severity: coverage < 0.5 ? "high" : "medium",
        message: `coverage ${result.covered_districts}/${result.expected_count}`,
        payload: { expected: result.expected_count, actual: result.covered_districts }
      });
    }
  }
}

async function postIngestVerification(sql, ep, ilSlug, sourceRows) {
  const sourceNames = (sourceRows || [])
    .map((row) => String(row?.name || "").trim())
    .filter(Boolean);
  if (!sourceNames.length) return null;

  const apiNames = await queryProvinceApiNames(sql, ilSlug);
  const diff = classifyNameDiff(apiNames, sourceNames);

  const hasAnyDiff = diff.missing.length || diff.extra.length || diff.mismatch.length;
  if (!hasAnyDiff) {
    return {
      matched: diff.matched,
      missing_count: 0,
      extra_count: 0,
      mismatch_count: 0
    };
  }

  await logAlert(sql, {
    ilSlug,
    provinceId: ep.province_id,
    endpointId: ep.endpoint_id,
    alertType: "verification_diff",
    severity: diffSeverity(diff),
    message: `missing=${diff.missing.length},extra=${diff.extra.length},mismatch=${diff.mismatch.length}`,
    payload: {
      duty_date: resolveActiveDutyDate(),
      matched: diff.matched,
      missing: diff.missing,
      extra: diff.extra,
      mismatch: diff.mismatch
    }
  });

  return {
    matched: diff.matched,
    missing_count: diff.missing.length,
    extra_count: diff.extra.length,
    mismatch_count: diff.mismatch.length
  };
}

async function queryProvinceApiNames(sql, ilSlug) {
  try {
    const rows = await sql`
      SELECT eczane_adi
      FROM api_active_duty
      WHERE il_slug = ${ilSlug}
    `;
    if (rows.length) {
      return rows.map((r) => r.eczane_adi).filter(Boolean);
    }
  } catch {
    // fallback below
  }

  const activeDate = resolveActiveDutyDate();
  const rows = await sql`
    SELECT ph.canonical_name AS eczane_adi
    FROM duty_records dr
    JOIN pharmacies ph ON ph.id = dr.pharmacy_id
    JOIN provinces p ON p.id = dr.province_id
    WHERE p.slug = ${ilSlug}
      AND dr.duty_date = ${activeDate}::date
    ORDER BY ph.canonical_name
  `;
  return rows.map((r) => r.eczane_adi).filter(Boolean);
}

async function applyCatalogOverrides(sql, ep, ilSlug, cfg = null) {
  const config = cfg ?? getProvinceSourceConfig(ilSlug);
  if (!config) {
    await logAlert(sql, {
      ilSlug,
      provinceId: ep.province_id,
      endpointId: ep.endpoint_id,
      alertType: "source_config_missing",
      severity: "high",
      message: `missing_source_catalog_entry:${ilSlug}`
    });
    return ep;
  }

  const drift = {};
  if (ep.endpoint_url !== config.officialSourceUrl) {
    drift.endpoint_url = { db: ep.endpoint_url, config: config.officialSourceUrl };
  }
  if (ep.parser_key !== config.parserKey) {
    drift.parser_key = { db: ep.parser_key, config: config.parserKey };
  }
  if (ep.format !== config.format) {
    drift.format = { db: ep.format, config: config.format };
  }

  if (Object.keys(drift).length) {
    await logAlert(sql, {
      ilSlug,
      provinceId: ep.province_id,
      endpointId: ep.endpoint_id,
      alertType: "source_config_drift",
      severity: "high",
      message: "db_source_endpoint_differs_from_catalog",
      payload: drift
    });
  }

  return {
    ...ep,
    endpoint_url: config.officialSourceUrl,
    parser_key: config.parserKey,
    format: config.format
  };
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
