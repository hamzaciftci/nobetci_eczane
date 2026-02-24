/**
 * Core ingestion logic for duty pharmacy data.
 *
 * Fetches HTML from a province's official pharmacist association endpoint,
 * parses the duty pharmacy list using multiple detection strategies, and
 * upserts records into: pharmacies → duty_records → duty_evidence
 *
 * Turkey has been permanently on UTC+3 since 2016 (no DST).
 * Duty window: 08:00 Istanbul → 08:00 next day = 05:00 UTC → 05:00 UTC+1day
 *
 * Supported HTML patterns:
 *  1. HTML tables (classic sites)
 *  2. inline-box with data-name/data-district (Ankara API response)
 *  3. Bootstrap card-divs with <h4> + fa-home + href="tel:" (most sites)
 *  4. <h1>/<h2> with fa-arrow-right district + fa-home address (Trabzon style)
 *  5. Ankara-style: main page loads data via getPharmacies/{date} AJAX API
 *  6. .nobetciDiv dual-tel links (Antalya)
 *  7. icon-user-md name + icon-home address (Burdur, Nigde, Kirklareli)
 *  8. .eczaneismi / .eczaneadres (Amasya)
 *  9. .trend-item with h3 name (Isparta)
 * 10. vatan_hl + icon-home (Karaman)
 * 11. POST to index.php with hash (Istanbul, Yalova)
 */

import { slugify } from "./slug.js";

const FETCH_TIMEOUT_MS = 12_000;
const CRAWL_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0";

// Turkey is permanently UTC+3 since 2016 (no DST)
// 08:00 Istanbul = 05:00 UTC
const DUTY_HOUR_UTC = 5;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Ingest duty pharmacies for a single province.
 * @returns {Promise<{status, il, found, upserted, elapsed_ms, error?}>}
 */
export async function ingestProvince(sql, ilSlug) {
  const started = Date.now();

  // 1. Fetch the primary enabled endpoint for this province
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
    return { status: "no_endpoint", il: ilSlug, found: 0, upserted: 0,
             elapsed_ms: Date.now() - started };
  }

  const ep = eps[0];

  // ── Special handler: Istanbul / Yalova POST API ──────────────────────────
  if (ep.parser_key === "istanbul_secondary_v1") {
    const { rows, httpStatus, error } = await fetchIstanbulRows(ep.endpoint_url, ilSlug);
    if (error && !rows.length) {
      await logRun(sql, ep.endpoint_id, "failed", httpStatus ?? null, error);
      return { status: "fetch_error", il: ilSlug, found: 0, upserted: 0,
               error, elapsed_ms: Date.now() - started };
    }
    if (!rows.length) {
      await logRun(sql, ep.endpoint_id, "partial", httpStatus ?? null, "no_pharmacies_after_filter");
      return { status: "no_data", il: ilSlug, found: 0, upserted: 0,
               elapsed_ms: Date.now() - started };
    }
    return await upsertRows(sql, ep, ilSlug, rows, httpStatus, started);
  }

  // 2. Fetch remote resource (regular HTML/JSON)
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
    return { status: "fetch_error", il: ilSlug, found: 0, upserted: 0,
             error: err.message, elapsed_ms: Date.now() - started };
  }

  // 3. Parse pharmacy rows (with AJAX fallback for dynamic sites)
  let rows;
  try {
    if (jsonData !== null) {
      rows = parseJsonPharmacies(jsonData, ep.parser_key);
    } else {
      rows = parseHtmlPharmacies(html, ep.parser_key);

      // If no data found AND site uses AJAX loading (e.g. Ankara getPharmacies)
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
    await logRun(sql, ep.endpoint_id, "partial", httpStatus, `parse_error: ${err.message}`);
    return { status: "parse_error", il: ilSlug, found: 0, upserted: 0,
             error: err.message, elapsed_ms: Date.now() - started };
  }

  if (!rows.length) {
    await logRun(sql, ep.endpoint_id, "partial", httpStatus, "no_pharmacies_parsed");
    return { status: "no_data", il: ilSlug, found: 0, upserted: 0,
             elapsed_ms: Date.now() - started };
  }

  return await upsertRows(sql, ep, ilSlug, rows, httpStatus, started);
}

// ─── DB upsert (shared between regular and Istanbul flows) ────────────────

async function upsertRows(sql, ep, ilSlug, rows, httpStatus, started) {
  // Resolve district list for this province
  const districts = await sql`
    SELECT id, name, slug FROM districts
    WHERE province_id = ${ep.province_id}
    ORDER BY name
  `;

  const today     = resolveToday();
  const { dutyStart, dutyEnd } = resolveDutyWindow(today);
  let upserted = 0;
  const errors = [];

  // Upsert each pharmacy
  for (const row of rows) {
    try {
      const districtId = resolveDistrictId(districts, row.district);
      if (!districtId) {
        errors.push(`no_district:${row.name}`);
        continue;
      }

      const normName = normalizeText(row.name);

      // a) Upsert pharmacy
      const [ph] = await sql`
        INSERT INTO pharmacies (
          id, province_id, district_id,
          canonical_name, normalized_name,
          address, phone, is_active, updated_at
        )
        VALUES (
          gen_random_uuid(), ${ep.province_id}, ${districtId},
          ${row.name}, ${normName},
          ${row.address || ""}, ${row.phone || ""},
          true, now()
        )
        ON CONFLICT (district_id, normalized_name) DO UPDATE SET
          canonical_name = EXCLUDED.canonical_name,
          address = CASE
            WHEN EXCLUDED.address != '' THEN EXCLUDED.address
            ELSE pharmacies.address
          END,
          phone = CASE
            WHEN EXCLUDED.phone != '' THEN EXCLUDED.phone
            ELSE pharmacies.phone
          END,
          is_active  = true,
          updated_at = now()
        RETURNING id
      `;

      // b) Upsert duty_record
      const [dr] = await sql`
        INSERT INTO duty_records (
          id, pharmacy_id, province_id, district_id,
          duty_date, duty_start, duty_end,
          confidence_score, verification_source_count,
          last_verified_at, is_degraded, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(),
          ${ph.id}, ${ep.province_id}, ${districtId},
          ${today}, ${dutyStart}, ${dutyEnd},
          80, 1, now(), false, now(), now()
        )
        ON CONFLICT (pharmacy_id, duty_date) DO UPDATE SET
          last_verified_at          = now(),
          updated_at                = now(),
          district_id               = EXCLUDED.district_id,
          is_degraded               = false,
          confidence_score          = GREATEST(duty_records.confidence_score, 80),
          verification_source_count = duty_records.verification_source_count + 1
        RETURNING id
      `;

      // c) Upsert duty_evidence
      await sql`
        INSERT INTO duty_evidence (
          duty_record_id, source_id, source_url,
          seen_at, extracted_payload
        )
        VALUES (
          ${dr.id}, ${ep.source_id}, ${ep.endpoint_url},
          now(),
          ${JSON.stringify({ name: row.name, address: row.address, phone: row.phone, district: row.district })}::jsonb
        )
        ON CONFLICT (duty_record_id, source_id, source_url) DO UPDATE SET
          seen_at = now()
      `;

      upserted++;
    } catch (err) {
      errors.push(`${row.name}: ${err.message.slice(0, 80)}`);
    }
  }

  const status =
    upserted === 0          ? "failed"  :
    upserted < rows.length  ? "partial" :
    "success";

  await logRun(
    sql, ep.endpoint_id, status, httpStatus,
    errors.length ? errors.slice(0, 5).join("; ") : null
  );

  return {
    status, il: ilSlug,
    found: rows.length, upserted,
    elapsed_ms: Date.now() - started,
    ...(errors.length ? { errors: errors.slice(0, 3) } : {})
  };
}

// ─── Date/time helpers ────────────────────────────────────────────────────

function resolveToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

function resolveDutyWindow(todayStr) {
  const dutyStart = new Date(`${todayStr}T0${DUTY_HOUR_UTC}:00:00Z`);
  const dutyEnd   = new Date(dutyStart.getTime() + 24 * 60 * 60 * 1000);
  return { dutyStart: dutyStart.toISOString(), dutyEnd: dutyEnd.toISOString() };
}

// ─── District resolution ──────────────────────────────────────────────────

function resolveDistrictId(districts, districtName) {
  if (!districts.length) return null;

  if (districtName && districtName.trim()) {
    const needle = slugify(districtName.trim());

    const bySlug  = districts.find(d => d.slug === needle);
    if (bySlug) return bySlug.id;

    const normNeedle = normalizeText(districtName);
    const byNorm  = districts.find(d => normalizeText(d.name) === normNeedle);
    if (byNorm) return byNorm.id;

    // Partial: needle inside slug or vice versa
    const partial = districts.find(d =>
      d.slug.includes(needle) || needle.includes(d.slug)
    );
    if (partial) return partial.id;
  }

  const merkez = districts.find(d =>
    d.slug === "merkez" || d.slug.endsWith("-merkez") ||
    normalizeText(d.name) === "merkez"
  );
  return merkez?.id ?? districts[0]?.id ?? null;
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/\s+/g, " ").trim();
}

// ─── ingestion_runs logging ───────────────────────────────────────────────

async function logRun(sql, endpointId, status, httpStatus, errorMsg) {
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

// ─── HTTP fetch ───────────────────────────────────────────────────────────

async function fetchResource(url) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":      CRAWL_UA,
        "Accept":          "text/html,application/xhtml+xml,application/json,*/*;q=0.9",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        "Accept-Charset":  "utf-8, windows-1254;q=0.7",
        "Referer":         url
      }
    });

    const buf = await resp.arrayBuffer();
    const ct  = resp.headers.get("content-type") || "";

    // JSON response
    if (ct.includes("application/json") || ct.includes("text/json")) {
      const text = new TextDecoder("utf-8").decode(buf);
      try {
        return { status: resp.status, json: JSON.parse(text), html: null };
      } catch { /* fall through */ }
    }

    // Detect charset from Content-Type header
    let charset = (ct.match(/charset=([^\s;,]+)/i)?.[1] || "").toLowerCase();
    const utf8  = new TextDecoder("utf-8").decode(buf);

    if (!charset) {
      const meta = utf8.match(/<meta[^>]+charset=["']?([^"'\s>;]+)/i)?.[1]?.toLowerCase();
      charset = meta || "utf-8";
    }

    let html = utf8;
    if (charset && charset !== "utf-8" && charset !== "utf8") {
      try { html = new TextDecoder(charset).decode(buf); } catch { /* fallback */ }
    }

    // If body is a JSON-with-html object (Ankara pattern)
    if (html.trim().startsWith("{")) {
      try {
        const obj = JSON.parse(html);
        if (obj?.html && typeof obj.html === "string") {
          return { status: resp.status, json: null, html: obj.html };
        }
        if (obj?.status === "success") {
          return { status: resp.status, json: obj, html: obj.html ?? null };
        }
      } catch { /* not JSON */ }
    }

    return { status: resp.status, html, json: null };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Istanbul / Yalova POST API ───────────────────────────────────────────
// The Istanbul Pharmacist Association loads pharmacy data via POST to index.php
// with a CSRF hash scraped from the main page. Both Istanbul (il=34) and
// Yalova (il=77) use the same endpoint; we filter by the `il` field in the response.

async function fetchIstanbulRows(endpointUrl, ilSlug) {
  // Step 1: Fetch main page to extract the hash token
  let pageHtml, pageStatus;
  try {
    const page = await fetchResource(endpointUrl);
    pageHtml   = page.html || "";
    pageStatus = page.status;
  } catch (err) {
    return { rows: [], httpStatus: null, error: `page_fetch: ${err.message}` };
  }

  const hashM = pageHtml.match(/id=["']h["']\s+value=["']([^"']+)["']/);
  if (!hashM) {
    return { rows: [], httpStatus: pageStatus, error: "istanbul_hash_missing" };
  }
  const hash = hashM[1];

  // Step 2: POST to index.php
  const apiUrl  = endpointUrl.replace(/\/?$/, "") + "/index.php";
  const apiBody = `jx=1&islem=get_eczane_markers&h=${encodeURIComponent(hash)}`;

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let json, httpStatus;
  try {
    const apiResp = await fetch(apiUrl, {
      method:  "POST",
      signal:  ctrl.signal,
      headers: {
        "User-Agent":      CRAWL_UA,
        "Content-Type":    "application/x-www-form-urlencoded",
        "Referer":         endpointUrl,
        "X-Requested-With":"XMLHttpRequest"
      },
      body: apiBody
    });
    httpStatus = apiResp.status;
    json = await apiResp.json();
  } catch (err) {
    return { rows: [], httpStatus, error: `api_post: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }

  if (!json || json.error !== 0) {
    return { rows: [], httpStatus, error: `istanbul_api_err: ${json?.message ?? ""}` };
  }

  // Step 3: Filter by province
  const isIstanbul = ilSlug === "istanbul";
  const eczaneler  = (json.eczaneler || []).filter(e => {
    const il = String(e.il || "").toLowerCase();
    return isIstanbul ? il.includes("stanbul") : il.includes("alova");
  });

  // Step 4: Map to standard row format
  const rows = eczaneler.map(e => ({
    name:     String(e.eczane_ad || "").trim(),
    district: String(e.ilce       || "").trim(),
    address:  [e.mahalle, e.cadde_sokak, e.bina_kapi, e.semt]
                .map(s => String(s || "").trim()).filter(Boolean).join(", "),
    phone:    cleanPhone(String(e.eczane_tel || ""))
  })).filter(r => r.name.length >= 3);

  return { rows, httpStatus, error: null };
}

// ─── AJAX API detection (Ankara-style: getPharmacies/{date}) ─────────────

function detectAjaxApiUrl(html, endpointUrl) {
  if (!html) return null;

  // Pattern: const url = "https://site.tr/getPharmacies/" + formattedDate
  const m1 = html.match(/["'](https?:\/\/[^"']+\/getPharm(?:acies)?\/?)["']\s*\+\s*\w+/i);
  if (m1) {
    const today = resolveToday();
    return m1[1].replace(/\/+$/, "") + "/" + today;
  }

  // Relative URL pattern: url = "/getPharmacies/" + dateVar
  const m2 = html.match(/url\s*=\s*["'](\/[^"']*getPharm(?:acies)?\/?)["']\s*\+/i);
  if (m2 && endpointUrl) {
    const base  = new URL(endpointUrl).origin;
    const today = resolveToday();
    return base + m2[1].replace(/\/+$/, "") + "/" + today;
  }

  return null;
}

// ─── Parsing dispatcher ───────────────────────────────────────────────────

/** Main HTML parse entry point — tries multiple strategies in order. */
export function parseHtmlPharmacies(html, parserKey = "generic_auto_v1") {
  if (!html) return [];

  // 1. Standard HTML tables
  const tableRows = tableParser(html);
  if (tableRows.length >= 2) return tableRows;

  // 2. inline-box with data-name / data-district (Ankara API HTML)
  const inlineRows = inlineBoxParser(html);
  if (inlineRows.length >= 2) return inlineRows;

  // 3. Bootstrap card-divs with <h4> + fa-home/fa-map-marker + tel (most sites)
  const cardRows = cardParser(html);
  if (cardRows.length >= 2) return cardRows;

  // 4. Antalya: .nobetciDiv with dual <a href="tel:"> (name + phone)
  const antalyaRows = antalyaParser(html);
  if (antalyaRows.length >= 1) return antalyaRows;

  // 5. icon-user-md name blocks (Burdur, Nigde, Kirklareli)
  const iconUserMdRows = iconUserMdParser(html);
  if (iconUserMdRows.length >= 1) return iconUserMdRows;

  // 6. .eczaneismi / .eczaneadres (Amasya)
  const eczaneIsmiRows = eczaneIsmiParser(html);
  if (eczaneIsmiRows.length >= 1) return eczaneIsmiRows;

  // 7. .trend-item cards with h3 name (Isparta)
  const trendRows = trendItemParser(html);
  if (trendRows.length >= 1) return trendRows;

  // 8. vatan_hl section + icon-home (Karaman)
  const karamanRows = karamanParser(html);
  if (karamanRows.length >= 1) return karamanRows;

  return [];
}

/** Parse pharmacy rows from a JSON API response. */
export function parseJsonPharmacies(data, _parserKey) {
  // Ankara-style: { status: "success", html: "..." }
  if (data?.html && typeof data.html === "string") {
    return parseHtmlPharmacies(data.html);
  }

  const items = Array.isArray(data)
    ? data
    : (data?.data ?? data?.pharmacies ?? data?.result ?? data?.items ?? []);
  if (!Array.isArray(items)) return [];

  return items.map(item => ({
    name:     String(item.name ?? item.pharmacy_name ?? item.eczane ?? item.ad ?? "").trim(),
    address:  String(item.address ?? item.adres ?? item.addr ?? "").trim(),
    phone:    String(item.phone ?? item.telefon ?? item.tel ?? "").trim(),
    district: String(item.district ?? item.ilce ?? item.district_name ?? "").trim()
  })).filter(r => r.name.length >= 3);
}

// ─── Strategy 1: HTML tables ──────────────────────────────────────────────

function tableParser(html) {
  const tables = extractTables(html);
  let best = tables.reduce((a, b) => b.rows.length > a.rows.length ? b : a, { rows: [] });
  if (best.rows.length < 2) return [];

  let headerIdx = -1;
  let cols = null;
  for (let i = 0; i < Math.min(4, best.rows.length); i++) {
    const c = detectTableCols(best.rows[i]);
    if (c.name >= 0) { headerIdx = i; cols = c; break; }
  }
  if (!cols) return [];

  const results = [];
  for (let i = headerIdx + 1; i < best.rows.length; i++) {
    const cells = best.rows[i];
    const name = clean(cells[cols.name] ?? "");
    if (!name || name.length < 3) continue;
    results.push({
      name,
      address:  cols.address  >= 0 ? clean(cells[cols.address]  ?? "") : "",
      phone:    cols.phone    >= 0 ? cleanPhone(cells[cols.phone]    ?? "") : "",
      district: cols.district >= 0 ? clean(cells[cols.district] ?? "") : ""
    });
  }
  return results;
}

function extractTables(html) {
  const tables = [];
  const tblRe  = /<table[\s\S]*?>([\s\S]*?)<\/table>/gi;
  let tm;
  while ((tm = tblRe.exec(html)) !== null) {
    const rows = [];
    const rowRe = /<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi;
    let rm;
    while ((rm = rowRe.exec(tm[1])) !== null) {
      const cells = [];
      const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let cm;
      while ((cm = cellRe.exec(rm[1])) !== null) {
        cells.push(decodeEntities(stripTags(cm[1])));
      }
      if (cells.some(c => c.trim())) rows.push(cells);
    }
    if (rows.length >= 2) tables.push({ rows });
  }
  return tables;
}

function detectTableCols(headers) {
  const cols = { name: -1, address: -1, phone: -1, district: -1 };
  headers.forEach((h, i) => {
    const n = normalizeText(h);
    if (cols.name     < 0 && /eczane|adi|name\b|isim/.test(n))          cols.name     = i;
    if (cols.address  < 0 && /adres|address/.test(n))                    cols.address  = i;
    if (cols.phone    < 0 && /telefon|tel\b|phone|gsm/.test(n))          cols.phone    = i;
    if (cols.district < 0 && /ilce|bolge|semt|district|mahalle/.test(n)) cols.district = i;
  });
  return cols;
}

// ─── Strategy 2: inline-box with data-name/data-district ─────────────────
// Used in: Ankara (getPharmacies API response)
// HTML: <div data-name="NAME" data-district="DISTRICT">...</div>
//       <p><h4>NAME ECZANESİ</h4>ADDRESS<br><span>PHONE</span></p>

function inlineBoxParser(html) {
  const results = [];
  const boxRe = /data-name="([^"]+)"[\s\S]{0,200}?data-district="([^"]+)"/g;
  let m;

  while ((m = boxRe.exec(html)) !== null) {
    const rawName     = m[1].trim();
    const rawDistrict = m[2].trim();

    const nextIdx = html.indexOf("data-name=", m.index + 10);
    const section = html.slice(m.index, nextIdx >= 0 ? nextIdx : m.index + 3000);

    // h4 for full pharmacy name (may be inside the <p> tag)
    const h4m = section.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    const name = h4m ? clean(stripTags(h4m[1])) : rawName;

    // <p> for address + phone
    // NOTE: In Ankara API HTML, <h4> is INSIDE the <p>, so remove it first
    const pm = section.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    let address = "", phone = "";
    if (pm) {
      let pHtml = pm[1]
        .replace(/<svg[\s\S]*?<\/svg>/gi, "")
        .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "");

      const telM  = pHtml.match(/href="tel:([^"]+)"/i) ||
                    pHtml.match(/<span[^>]*>([0-9 ()-]{7,})<\/span>/i);
      phone = telM ? cleanPhone(telM[1]) : "";

      const stripped = clean(stripTags(pHtml));
      address = clean(stripped.replace(phone, "").replace(/\s{2,}/g, " "));
    }

    if (name.length >= 3) {
      results.push({ name, address, phone, district: rawDistrict });
    }
  }
  return results;
}

// ─── Strategy 3: Bootstrap card-divs (most Turkish pharmacy sites) ────────
// Patterns:
//   <h4><strong>NAME ECZANESİ</strong> - DISTRICT</h4>   (Adana, Osmaniye)
//   <h4 class="main-color">DISTRICT BUGÜN NÖBETÇİ ECZANELER</h4>  (section header)
//   <h4>NAME ECZANESİ</h4>
//   <h1><strong>NAME ECZANESİ</strong></h1>
//   <h3 class="theme">NAME ECZANESİ</h3>  (Isparta)
//   <i class="fa fa-home ..."> ADDRESS
//   <i class="fa fa-map-marker ..."> ADDRESS   (Isparta fallback)
//   <a href="tel:PHONE">  OR plain text after fa-phone  (Isparta fallback)

function cardParser(html) {
  const headingRe = /<h[1-5][^>]*>([\s\S]*?)<\/h[1-5]>/gi;
  const headings  = [];
  let hm;
  while ((hm = headingRe.exec(html)) !== null) {
    const text = clean(stripTags(hm[1]));
    if (/ECZ|ecz/i.test(text) && text.length >= 5) {
      headings.push({ idx: hm.index, end: hm.index + hm[0].length, text });
    }
  }

  if (!headings.length) return [];

  const results = [];
  let currentSectionDistrict = "";

  for (let i = 0; i < headings.length; i++) {
    const h       = headings[i];
    const nextIdx = headings[i + 1]?.idx ?? html.length;
    const section = html.slice(h.idx, Math.min(nextIdx, h.idx + 2500));

    let name     = h.text;
    let district = "";

    // ── Detect section headers (district groupings, not individual pharmacies) ──
    if (/ECZANELER|eczaneler/i.test(name)) {
      const districtOnly = name
        .replace(/\s*BUGÜN\s+/i, " ")
        .replace(/\s*NÖBETÇİ\s+ECZANELER.*/i, "")
        .replace(/\s*ECZANELER.*/i, "")
        .replace(/\s*HAFTALIK\s+.*/i, "")
        .replace(/\s*\d{2}[\-\.\/]\d{2}[\-\.\/]\d{4}.*/g, "")
        .trim();
      if (districtOnly.length >= 3 && districtOnly.length <= 40 &&
          !districtOnly.toLowerCase().includes("eczac")) {
        currentSectionDistrict = districtOnly;
      }
      continue;
    }

    // ── Individual pharmacy entry ──

    // Pattern: "PHARMACY NAME - DISTRICT" in the heading text
    const dashM = name.match(/^(.+?)\s+-\s+(.+)$/);
    if (dashM && !dashM[2].toLowerCase().includes("eczane")) {
      name     = dashM[1].trim();
      district = dashM[2].trim();
    }

    // Fallback district from fa-arrow-right (Trabzon/Artvin style)
    if (!district) {
      const arrowM = section.match(/fa-arrow-right[^>]*(?:><\/i>|>)\s*([\s\S]{1,60}?)(?:<br|<\/span|<i\s)/i);
      if (arrowM) district = clean(stripTags(arrowM[1]));
    }

    // Fallback district from <h5> within section (Isparta style)
    if (!district) {
      const h5M = section.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i);
      if (h5M) {
        const h5text = clean(stripTags(h5M[1]));
        if (h5text.length >= 2 && h5text.length <= 40 && !/ecz/i.test(h5text)) {
          district = h5text;
        }
      }
    }

    // Fallback to current section district (Adana/Istanbul style)
    if (!district && currentSectionDistrict) {
      district = currentSectionDistrict;
    }

    // Phone: prefer href="tel:", fall back to plain text after fa-phone/icon-phone
    const telM  = section.match(/href="tel:([^"]+)"/i);
    let phone = "";
    if (telM) {
      phone = cleanPhone(telM[1]);
    } else {
      const phonePlainM = section.match(/(?:fa-phone|icon-phone)[^>]*(?:><\/i>|>)\s*([\d\s()+\-]{7,20}?)(?:<br|<\/|<i|<a)/i);
      if (phonePlainM) phone = cleanPhone(phonePlainM[1]);
    }

    // Address: prefer fa-home, fall back to fa-map-marker (not a map link)
    let address = "";
    const homeM = section.match(/(?:fa-home|icon-home)[^>]*(?:><\/i>|>)\s*([\s\S]{3,400}?)(?:<br\s*\/?>|<a\s|<\/p|<i\s)/i);
    if (homeM) {
      address = clean(stripTags(homeM[1]));
    } else {
      // fa-map-marker: but avoid map links (only use plain text paragraphs)
      const mapM = section.match(/fa-map-marker[^>]*(?:><\/i>|>)\s*((?:(?!<a)[^<]|<[^a/]){3,300}?)(?:<br\s*\/?>|<\/p|<\/div|<i\s)/i);
      if (mapM) {
        const candidate = clean(stripTags(mapM[1]));
        // Only use if it looks like an address (not "Harita Konumu" etc.)
        if (candidate.length >= 5 && !/harita|konum|map/i.test(candidate)) {
          address = candidate;
        }
      }
    }

    // Skip entries without phone AND address (stray headings / nav links)
    if (!phone && !address) continue;

    if (name.length >= 3) {
      results.push({ name, address, phone, district });
    }
  }

  return results;
}

// ─── Strategy 4: Antalya .nobetciDiv (dual tel links: first=name, second=phone) ──
// HTML: <div class="nesne row nobetciDiv">
//         <div class="col-md-4 ..."><div class="hucre hucre-ortala">
//           <a href="tel:0242-237-0088">EFENDİOĞLU ECZANESİ</a>
//           <br /><a href="tel:0242-237-0088">0(242) 237-00-88</a>
//         </div></div>
//         <div class="col-md-8 ..."><div class="hucre hucre-ortala">
//           <a href="https://maps.google.com/..." class="nadres">ADDRESS</a>
//         </div></div>
//       </div>

function antalyaParser(html) {
  if (!html.includes("nobetciDiv")) return [];
  const results = [];

  // Split on nobetciDiv blocks
  const parts = html.split(/class="[^"]*nobetciDiv[^"]*"/gi);

  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].slice(0, 3000);

    // Find all tel: links in this block
    const tels = [...block.matchAll(/href="tel:([^"]+)"[^>]*>([^<]+)</gi)];
    if (tels.length < 1) continue;

    // First tel link: its text is the pharmacy NAME
    const firstTelText  = clean(tels[0][2]);
    const firstTelPhone = cleanPhone(tels[0][1]);

    let name = "", phone = "";

    // If the first link text looks like a pharmacy name (has letters), use it as name
    if (/[A-ZÇĞİÖŞÜa-zçğışöşü]{3}/.test(firstTelText) && firstTelText.length > 4) {
      name  = firstTelText;
      // Phone is either second tel link's text, or fallback to first tel's href
      phone = tels.length >= 2 ? cleanPhone(tels[1][2]) : firstTelPhone;
    } else {
      // Fallback: first tel href is the phone
      phone = firstTelPhone;
    }

    if (!name || name.length < 3) continue;

    // Address from .nadres link (Google Maps link with address text)
    const nadresM = block.match(/class="nadres"[^>]*>([\s\S]*?)<\/a>/i);
    let address = "";
    if (nadresM) {
      address = clean(stripTags(nadresM[1]));
    }

    results.push({ name, address, phone, district: "" });
  }

  return results;
}

// ─── Strategy 5: icon-user-md / strong-ECZ name (Burdur, Nigde, Kirklareli) ──
// Burdur/Kirklareli: <strong><i class="icon-user-md"></i> ÖZBAĞCI ECZANESİ </strong>
// Nigde:            <strong>ULUSAN ECZANESİ </strong>  (no icon-user-md)
//                   <i class="icon-hand-right"></i> MERKEZ<br>
//                   <i class="icon-home"></i> ADDRESS<br>
//                   <i class="icon-phone"></i> <a href="tel:...">PHONE</a>  OR plain text

function iconUserMdParser(html) {
  if (!html.includes("icon-home")) return [];
  // Require at least one of these triggers to avoid false positives
  if (!html.includes("icon-user-md") && !html.includes("icon-hand-right")) return [];
  const results = [];

  // Match <strong> elements containing either icon-user-md OR pharmacy name (ECZ)
  const re = /<strong[^>]*>([\s\S]{1,150}?(?:icon-user-md|ecz)[\s\S]{0,150}?)<\/strong>/gi;
  let m;

  while ((m = re.exec(html)) !== null) {
    const name = clean(stripTags(m[0]));
    if (name.length < 3 || !/ecz/i.test(name)) continue;
    // Skip non-pharmacy strongs (navigation links etc.)
    if (/rehber|işlemleri|listesi|odası/i.test(name)) continue;

    // Section of HTML after this <strong> block
    const section = html.slice(m.index + m[0].length, m.index + m[0].length + 2000);

    // District after icon-hand-right, before <br> or next icon
    const distM = section.match(/icon-hand-right[^>]*(?:><\/i>|>)\s*([\s\S]{1,60}?)(?:<br|<\/|<i\s)/i);
    const district = distM ? clean(stripTags(distM[1])) : "";

    // Address after icon-home, before <br> or next paragraph/icon
    const addrM = section.match(/icon-home[^>]*(?:><\/i>|>)\s*([\s\S]{3,300}?)(?:<br|<\/p|<i\s)/i);
    const address = addrM ? clean(stripTags(addrM[1])) : "";

    // Phone: tel: link preferred, then plain text after icon-phone
    const telM = section.match(/href="tel:([^"]+)"/i);
    let phone = "";
    if (telM) {
      phone = cleanPhone(telM[1]);
    } else {
      const phoneM = section.match(/icon-phone[^>]*(?:><\/i>|>)\s*([\d\s()+\-]{7,20}?)(?:<br|<\/|<i|<a)/i);
      if (phoneM) phone = cleanPhone(phoneM[1]);
    }

    if (name.length >= 3 && (phone || address)) {
      results.push({ name, district, address, phone });
    }
  }

  return results;
}

// ─── Strategy 6: .eczaneismi / .eczaneadres (Amasya) ─────────────────────
// HTML: <h4>Amasya Nöbetçi Eczaneler</h4>  ← district heading
//       <div class="eczanebilgileri">
//         <div class="eczaneismi">Merve Eczanesi - 0358 252 33 33</div>
//         <div class="eczaneadres">ŞEYHCUİ MAH. MACİT ZEREN CAD. 33-A</div>
//         <a class="iara" href="tel:0358 252 33 33">...</a>
//       </div>

function eczaneIsmiParser(html) {
  if (!html.includes("eczaneismi")) return [];
  const results = [];

  const ismiRe = /class="eczaneismi"[^>]*>([\s\S]*?)<\/div>/gi;
  let m;

  while ((m = ismiRe.exec(html)) !== null) {
    const ismiText = clean(stripTags(m[1]));
    if (!ismiText || ismiText.length < 3) continue;

    // ismiText format: "Pharmacy Name - 0xxx xxx xx xx" (name + phone)
    // or just the pharmacy name
    let name = ismiText, phone = "";
    const dashM = ismiText.match(/^(.+?)\s*-\s*([\d\s()]{7,})\s*$/);
    if (dashM) {
      name  = clean(dashM[1]);
      phone = cleanPhone(dashM[2]);
    }

    // Get address from nearby .eczaneadres
    const afterIsmi  = html.slice(m.index, m.index + 800);
    const addrM      = afterIsmi.match(/class="eczaneadres"[^>]*>([\s\S]*?)<\/div>/i);
    const address    = addrM ? clean(stripTags(addrM[1])) : "";

    // Get phone from tel: link if not found in ismiText
    if (!phone) {
      const telM = afterIsmi.match(/href="tel:([^"]+)"/i);
      if (telM) phone = cleanPhone(telM[1]);
    }

    // Find preceding <h4> for district
    const beforeIsmi  = html.slice(Math.max(0, m.index - 3000), m.index);
    const h4matches   = [...beforeIsmi.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)];
    let district = "";
    if (h4matches.length) {
      const lastH4text = clean(stripTags(h4matches[h4matches.length - 1][1]));
      district = lastH4text
        .replace(/\s*nöbetçi\s+eczaneler?/i, "")
        .replace(/\s*nobetci\s+eczaneler?/i, "")
        .trim();
      if (district.length > 40 || district.length < 2) district = "";
    }

    if (name.length >= 3) {
      results.push({ name, district, address, phone });
    }
  }

  return results;
}

// ─── Strategy 7: .trend-item cards (Isparta) ─────────────────────────────
// HTML: <div class="trend-item ...">
//         <div class="trend-content">
//           <h3 class="theme">YAĞMUR ECZANESİ</h3>
//           <h5>MERKEZ</h5>
//           <p class="mb-2"><i class="fa fa-map-marker theme"></i> ADDRESS</p>
//           <p class="mb-2"><i class="fa fa-phone theme"></i> 02462325440 ...</p>
//         </div>
//       </div>

function trendItemParser(html) {
  if (!html.includes("trend-content")) return [];
  const results = [];

  const blockRe = /class="trend-content"[^>]*>([\s\S]*?)(?=class="trend-content"|<\/section|<\/div\s*>\s*<\/div\s*>\s*<\/div\s*>\s*<div\s)/gi;
  let m;

  while ((m = blockRe.exec(html)) !== null) {
    const block = m[1];

    // Name from h3
    const h3M = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (!h3M) continue;
    const name = clean(stripTags(h3M[1]));
    if (name.length < 3 || !/ecz/i.test(name)) continue;

    // District from h5
    const h5M = block.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i);
    const district = h5M ? clean(stripTags(h5M[1])) : "";

    // Address from fa-map-marker paragraph
    const addrM = block.match(/fa-map-marker[^>]*(?:><\/i>|>)\s*([\s\S]{3,300}?)(?:<br|<\/p|<\/div|<i\s|<a\s)/i);
    let address = "";
    if (addrM) {
      const candidate = clean(stripTags(addrM[1]));
      if (!/harita|konum|map/i.test(candidate)) address = candidate;
    }

    // Phone: tel: link or plain text after fa-phone
    const telM = block.match(/href="tel:([^"]+)"/i);
    let phone = "";
    if (telM) {
      phone = cleanPhone(telM[1]);
    } else {
      const phonePlainM = block.match(/fa-phone[^>]*(?:><\/i>|>)\s*([\d\s()+\-]{7,20}?)(?:<br|<\/|<i|<a)/i);
      if (phonePlainM) phone = cleanPhone(phonePlainM[1]);
    }

    if (name.length >= 3 && (phone || address)) {
      results.push({ name, district, address, phone });
    }
  }

  return results;
}

// ─── Strategy 8: vatan_hl sections + icon-home (Karaman) ─────────────────
// HTML: <h2 class="vatan_hl"><span class="vatan_span">Merkez Nöbetçi Eczaneler
//         <br />24-02-2026</span></h2>
//       <div class="col-xs-10 col-sm-9">
//         <h4><i class="icon-arrow-right"></i>ALTAY </h4>
//         <p><i class="icon-home"></i> ADDRESS<br>
//            <i class="icon-phone"></i> PHONE</p>
//       </div>

function karamanParser(html) {
  if (!html.includes("vatan_hl") || !html.includes("icon-home")) return [];
  const results = [];

  // Collect district section headers (h2.vatan_hl)
  const distHeaders = [];
  const distRe = /<h2[^>]*class="[^"]*vatan_hl[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi;
  let dm;
  while ((dm = distRe.exec(html)) !== null) {
    const text = clean(stripTags(dm[1]))
      .replace(/\s*nöbetçi\s+eczaneler?/i, "")
      .replace(/\s*nobetci\s+eczaneler?/i, "")
      .replace(/\s*\d{1,2}[\-\.\/]\d{1,2}[\-\.\/]\d{2,4}.*/g, "")
      .trim();
    if (text.length >= 2 && text.length <= 50) {
      distHeaders.push({ idx: dm.index, district: text });
    }
  }

  // For each icon-home, look backwards for pharmacy name and district
  const homeRe = /icon-home[^>]*(?:><\/i>|>)\s*([\s\S]{3,300}?)(?:<br\s*\/?>|<\/p|<i\s)/gi;
  let hm;
  while ((hm = homeRe.exec(html)) !== null) {
    const address = clean(stripTags(hm[1]));
    if (!address || address.length < 5) continue;

    // Nearest preceding district header
    const nearestDist = distHeaders
      .filter(d => d.idx < hm.index)
      .sort((a, b) => b.idx - a.idx)[0];
    const district = nearestDist?.district ?? "";

    // Pharmacy name: last h4 within 800 chars before icon-home
    const before = html.slice(Math.max(0, hm.index - 800), hm.index);
    const h4all  = [...before.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)];
    if (!h4all.length) continue;
    const name = clean(stripTags(h4all[h4all.length - 1][1]));
    if (!name || name.length < 2) continue;
    // Skip if looks like a section header
    if (/eczaneler|nöbetçi/i.test(name)) continue;

    // Phone: forward 500 chars from address
    const after = html.slice(hm.index + hm[0].length, hm.index + hm[0].length + 500);
    const telM  = after.match(/href="tel:([^"]+)"/i);
    let phone = "";
    if (telM) {
      phone = cleanPhone(telM[1]);
    } else {
      const phoneM = after.match(/icon-phone[^>]*(?:><\/i>|>)\s*([\d\s()+\-]{7,20}?)(?:<br|<\/|<i|<a)/i);
      if (phoneM) phone = cleanPhone(phoneM[1]);
    }

    if (name.length >= 2 && (address || phone)) {
      results.push({ name, district, address, phone });
    }
  }

  return results;
}

// ─── HTML utilities ───────────────────────────────────────────────────────

function stripTags(s) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi,   "<").replace(/&gt;/gi,   ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi,  "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ");
}

function clean(s)       { return s.replace(/\s+/g, " ").trim(); }
function cleanPhone(s)  { return s.replace(/[^\d+() -]/g, "").replace(/\s+/g, " ").trim(); }
