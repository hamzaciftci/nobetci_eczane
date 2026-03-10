/**
 * scrapeProvince.mjs
 *
 * ingestProvince'ın fetch + parse adımlarını DB yazımı olmadan tekrar eder.
 * Canlı kaynaktan eczane isimlerini döndürür — doğrulama / test amaçlı.
 *
 * ingest.js'den bilinçli olarak ayrı tutulur: logging, upsert, alert yok.
 */

import {
  fetchAnkaraRows,
  fetchDutyFormHtml,
  fetchIstanbulRows,
  fetchOrduRows,
  fetchOsmaniyeHtml,
  fetchUsakRows,
  fetchResource,
  FETCH_TIMEOUT_MS,
} from "../../api/_lib/ingest/fetchLayer.js";
import {
  detectAjaxApiUrl,
  parseHtmlPharmacies,
  parseJsonPharmacies,
} from "../../api/_lib/ingest/parserLayer.js";

/** Scrape timeout — fetch timeout'tan biraz daha uzun */
const SCRAPE_TIMEOUT_MS = FETCH_TIMEOUT_MS + 3_000;
const DUTY_FORM_FALLBACK_PARSER_KEYS = new Set([
  // Opt-in only. Keep empty by default to prevent false positives across 81 provinces.
]);

/**
 * Belirtilen endpoint için canlı kaynaktan eczane isimlerini çeker.
 *
 * @param {{ endpoint_url: string, parser_key: string, format: string }} ep
 * @param {string} ilSlug
 * @returns {Promise<{
 *   names: string[],
 *   rawRows: Array<{ name: string, district: string, address: string, phone: string }>,
 *   httpStatus: number|null,
 *   error: string|null,
 *   elapsed_ms: number
 * }>}
 */
export async function scrapeProvince(ep, ilSlug) {
  const started = Date.now();

  const result = await Promise.race([
    _scrape(ep, ilSlug),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`scrape_timeout_${SCRAPE_TIMEOUT_MS}ms`)),
        SCRAPE_TIMEOUT_MS
      )
    ),
  ]).catch((err) => ({
    names: [],
    rawRows: [],
    httpStatus: null,
    error: err.message,
  }));

  return { ...result, elapsed_ms: Date.now() - started };
}

// ─── Internal ─────────────────────────────────────────────────────────────

async function _scrape(ep, ilSlug) {
  // Ankara: aeo.org.tr getPharmacies AJAX akışı
  if (ep.parser_key === "ankara_ajax_v1") {
    const { rows, httpStatus, error } = await fetchAnkaraRows(ep.endpoint_url);
    if (error && !rows.length) {
      return { names: [], rawRows: [], httpStatus, error };
    }
    return {
      names: rows.map((r) => r.name).filter(Boolean),
      rawRows: rows,
      httpStatus,
      error: null,
    };
  }

  // Ordu: eczanesistemi.net çoklu iframe akışı
  if (ep.parser_key === "eczanesistemi_iframe_v1") {
    const { rows, httpStatus, error } = await fetchOrduRows(ep.endpoint_url);
    if (error && !rows.length) {
      return { names: [], rawRows: [], httpStatus, error };
    }
    return {
      names: rows.map((r) => r.name).filter(Boolean),
      rawRows: rows,
      httpStatus,
      error: null,
    };
  }

  // İstanbul / Yalova: özel POST API akışı
  if (ep.parser_key === "istanbul_secondary_v1") {
    const { rows, httpStatus, error } = await fetchIstanbulRows(
      ep.endpoint_url,
      ilSlug
    );
    if (error && !rows.length) {
      return { names: [], rawRows: [], httpStatus, error };
    }
    return {
      names: rows.map((r) => r.name).filter(Boolean),
      rawRows: rows,
      httpStatus,
      error: null,
    };
  }

  // Uşak: özel AJAX akışı
  if (ep.parser_key === "usak_ajax_v1") {
    const { rows, httpStatus, error } = await fetchUsakRows(ep.endpoint_url);
    if (error && !rows.length) {
      return { names: [], rawRows: [], httpStatus, error };
    }
    return {
      names: rows.map((r) => r.name).filter(Boolean),
      rawRows: rows,
      httpStatus,
      error: null,
    };
  }

  // Osmaniye: resmi sitede güncel liste POST form ile geliyor
  if (ep.parser_key === "osmaniye_eo_v1") {
    const { html, httpStatus, error } = await fetchOsmaniyeHtml(ep.endpoint_url);
    if (error && !html) {
      return { names: [], rawRows: [], httpStatus, error };
    }
    let rows = [];
    try {
      rows = parseHtmlPharmacies(html, ep.parser_key);
    } catch (err) {
      return {
        names: [],
        rawRows: [],
        httpStatus,
        error: `parse_error: ${err.message}`,
      };
    }
    return {
      names: rows.map((r) => r.name).filter(Boolean),
      rawRows: rows,
      httpStatus,
      error: null,
    };
  }

  // Standart akış: fetch → parse
  let html = null;
  let jsonData = null;
  let httpStatus = null;

  try {
    const fetched = await fetchResource(ep.endpoint_url);
    httpStatus = fetched.status;

    if (ep.format === "api" || ep.parser_key === "generic_api_v1") {
      jsonData = fetched.json;
    } else {
      html = fetched.html;
    }
  } catch (err) {
    return {
      names: [],
      rawRows: [],
      httpStatus,
      error: `fetch_error: ${err.message}`,
    };
  }

  let rows = [];
  try {
    if (jsonData !== null) {
      rows = parseJsonPharmacies(jsonData, ep.parser_key);
    } else {
      rows = parseHtmlPharmacies(html, ep.parser_key);

      if (DUTY_FORM_FALLBACK_PARSER_KEYS.has(ep.parser_key)) {
        const formResult = await fetchDutyFormHtml(ep.endpoint_url, html);
        if (formResult.usedForm && !formResult.error && formResult.html) {
          const formRows = parseHtmlPharmacies(formResult.html, ep.parser_key);
          if (formRows.length > 0) {
            rows = formRows;
            httpStatus = formResult.httpStatus ?? httpStatus;
          }
        }
      }

      // AJAX fallback (bazı iller)
      if (rows.length === 0) {
        const ajaxUrl = detectAjaxApiUrl(html, ep.endpoint_url);
        if (ajaxUrl) {
          const ajaxResult = await fetchResource(ajaxUrl);
          if (ajaxResult.html) {
            rows = parseHtmlPharmacies(ajaxResult.html, ep.parser_key);
          }
        }
      }
    }
  } catch (err) {
    return {
      names: [],
      rawRows: [],
      httpStatus,
      error: `parse_error: ${err.message}`,
    };
  }

  return {
    names: rows.map((r) => r.name).filter(Boolean),
    rawRows: rows,
    httpStatus,
    error: null,
  };
}
