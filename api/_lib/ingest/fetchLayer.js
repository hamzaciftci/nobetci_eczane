import { cleanPhone } from "./utils.js";
import { resolveToday } from "./normalizeLayer.js";

export const FETCH_TIMEOUT_MS = 10_000;
export const FETCH_MAX_ATTEMPTS = 3;
export const CRAWL_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0";

// ---------------------------------------------------------------------------
// SSRF koruması — SEC-005
// ---------------------------------------------------------------------------
// Block-list: özel IP'ler, loopback, cloud metadata, tehlikeli protokoller.
// Whitelist değil block-list — 81 il + dinamik AJAX/iframe URL'leri statik
// listede tutmak mümkün değil; tehlikeli sınıfları engellemek yeterli.
// ---------------------------------------------------------------------------

const PRIVATE_IP_PATTERNS = Object.freeze([
  /^127\./,                       // loopback
  /^10\./,                        // RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./,  // RFC 1918
  /^192\.168\./,                  // RFC 1918
  /^169\.254\./,                  // link-local / IMDS (AWS, GCP, Azure)
  /^::1$/,                        // IPv6 loopback
  /^fc00:/i,                      // IPv6 ULA
  /^fe80:/i,                      // IPv6 link-local
]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "169.254.169.254",
  "169.254.170.2",
]);

/**
 * Verilen URL'nin SSRF açısından güvenli olup olmadığını doğrular.
 * Tehlikeli URL'lerde Error fırlatır.
 * @param {string} rawUrl
 * @throws {Error}
 */
export function assertAllowedFetchUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`ssrf_invalid_url: ${String(rawUrl).slice(0, 120)}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`ssrf_blocked_protocol: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`ssrf_blocked_host: ${hostname}`);
  }

  if (
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost")
  ) {
    throw new Error(`ssrf_blocked_tld: ${hostname}`);
  }

  // IP literal → özel aralık kontrolü (public IP'lere izin ver)
  const isIpLiteral = /^[\d.]+$|^\[[\da-f:]+\]$/i.test(hostname);
  if (isIpLiteral) {
    const bare = hostname.replace(/^\[|\]$/g, "");
    if (PRIVATE_IP_PATTERNS.some((re) => re.test(bare))) {
      throw new Error(`ssrf_blocked_private_ip: ${bare}`);
    }
  }
}

export async function fetchResource(url) {
  // SEC-005: SSRF koruması — her çağrı için URL doğrulanır
  assertAllowedFetchUrl(url);

  let lastError = null;

  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    try {
      const resp = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": CRAWL_UA,
          Accept: "text/html,application/xhtml+xml,application/json,*/*;q=0.9",
          "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
          "Accept-Charset": "utf-8, windows-1254;q=0.7",
          Referer: url
        }
      });

      const buf = await resp.arrayBuffer();
      const ct = resp.headers.get("content-type") || "";

      if (ct.includes("application/json") || ct.includes("text/json")) {
        const text = new TextDecoder("utf-8").decode(buf);
        try {
          return { status: resp.status, json: JSON.parse(text), html: null };
        } catch {
          /* fall through */
        }
      }

      let charset = (ct.match(/charset=([^\s;,]+)/i)?.[1] || "").toLowerCase();
      const utf8 = new TextDecoder("utf-8").decode(buf);

      if (!charset) {
        const meta = utf8.match(/<meta[^>]+charset=["']?([^"'\s>;]+)/i)?.[1]?.toLowerCase();
        charset = meta || "utf-8";
      }

      let html = utf8;
      if (charset && charset !== "utf-8" && charset !== "utf8") {
        try {
          html = new TextDecoder(charset).decode(buf);
        } catch {
          /* fallback to utf8 */
        }
      }

      if (html.trim().startsWith("{")) {
        try {
          const obj = JSON.parse(html);
          if (obj?.html && typeof obj.html === "string") {
            return { status: resp.status, json: null, html: obj.html };
          }
          if (obj?.status === "success") {
            return { status: resp.status, json: obj, html: obj.html ?? null };
          }
        } catch {
          /* not JSON */
        }
      }

      return { status: resp.status, html, json: null };
    } catch (err) {
      lastError = err;
      if (attempt < FETCH_MAX_ATTEMPTS && isTransientFetchError(err)) {
        await sleep(250 * attempt);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error("fetch_failed");
}

/**
 * Tries to submit a "show duty pharmacies" form from the source HTML.
 * If no matching form is found, returns usedForm=false.
 */
export async function fetchDutyFormHtml(endpointUrl, sourceHtml) {
  const form = selectDutyForm(sourceHtml);
  if (!form) {
    return { usedForm: false, html: "", httpStatus: null, error: null };
  }

  const payload = buildDutyFormPayload(form.html);
  if (!payload) {
    return { usedForm: false, html: "", httpStatus: null, error: "duty_form_payload_empty" };
  }

  const targetUrl = resolveActionUrl(endpointUrl, form.action);
  const method = form.method || "POST";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  try {
    let resp;
    if (method === "GET") {
      const url = appendQuery(targetUrl, payload.toString());
      resp = await fetch(url, {
        method: "GET",
        signal: ctrl.signal,
        headers: {
          "User-Agent": CRAWL_UA,
          "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
          Referer: endpointUrl
        },
        cache: "no-store"
      });
    } else {
      resp = await fetch(targetUrl, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "User-Agent": CRAWL_UA,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
          Referer: endpointUrl
        },
        body: payload.toString(),
        cache: "no-store"
      });
    }

    const html = await resp.text();
    return {
      usedForm: true,
      html,
      httpStatus: resp.status,
      error: null
    };
  } catch (err) {
    return {
      usedForm: true,
      html: "",
      httpStatus: null,
      error: `duty_form_fetch: ${err.message}`
    };
  } finally {
    clearTimeout(timer);
  }
}

// Ordu eczanesistemi.net multi-iframe helper
export async function fetchOrduRows(endpointUrl) {
  // Fetch main page -> extract all eczanesistemi.net iframe URLs -> fetch each -> combine
  let mainHtml, mainStatus;
  try {
    const page = await fetchResource(endpointUrl);
    mainHtml = page.html ?? "";
    mainStatus = page.status;
  } catch (err) {
    return { rows: [], httpStatus: null, error: `page_fetch: ${err.message}` };
  }

  const iframeUrls = [
    ...new Set(
      (mainHtml.match(/https?:\/\/[a-z]+\.eczanesistemi\.net\/list\/\d+/gi) ?? [])
    )
  ];
  if (!iframeUrls.length) {
    return { rows: [], httpStatus: mainStatus, error: "eczanesistemi_no_iframes" };
  }

  const allRows = [];
  for (const url of iframeUrls) {
    try {
      const r = await fetchResource(url);
      const rHtml = r.html ?? "";
      const re = /<a href="https:\/\/maps\.google\.com[^"]*"[^>]*style="[^"]*font-weight:bold[^"]*"[^>]*>([^<]+)<\/a>/gi;
      let m;
      while ((m = re.exec(rHtml)) !== null) {
        const name = m[1].trim().replace(/^(?:GÜNDÜZ-GECE|GECE|GÜNDÜZ)\s*[:\s]+/i, "").trim();
        if (name.length >= 3) allRows.push({ name, district: "", address: "", phone: "" });
      }
    } catch {
      /* skip individual list failures */
    }
  }

  return { rows: allRows, httpStatus: mainStatus, error: null };
}

// Ankara aeo.org.tr getPharmacies AJAX helper
export async function fetchAnkaraRows(baseUrl) {
  const today = resolveToday();
  const origin = new URL(baseUrl).origin;
  const ajaxUrl = `${origin}/getPharmacies/${today}`;

  let html, httpStatus;
  try {
    const r = await fetchResource(ajaxUrl);
    html = r.html ?? "";
    httpStatus = r.status;
  } catch (err) {
    return { rows: [], httpStatus: null, error: `ajax_fetch: ${err.message}` };
  }

  if (!html) {
    return { rows: [], httpStatus, error: "empty_ajax_response" };
  }

  const rows = [];
  const re = /data-name="([^"]+)"\s+data-district="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = m[1].trim();
    const district = m[2].trim();
    if (name.length < 3) continue;

    // Adres ve telefon: <h4>NAME</h4> ve <p>... <span>PHONE</span></p>
    const nextIdx = html.indexOf("data-name=", m.index + 10);
    const section = html.slice(m.index, nextIdx >= 0 ? nextIdx : m.index + 3000);

    const h4m = section.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    const canonicalName = h4m
      ? h4m[1].replace(/<[^>]+>/g, "").trim()
      : name;

    const pm = section.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    let address = "", phone = "";
    if (pm) {
      const pHtml = pm[1].replace(/<svg[\s\S]*?<\/svg>/gi, "");
      const spanM = pHtml.match(/<span[^>]*>([0-9 ()+-]{7,})<\/span>/i);
      const telM = pHtml.match(/href="tel:([^"]+)"/i);
      phone = cleanPhone((spanM ?? telM)?.[1] ?? "");
      address = pHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (phone) address = address.replace(phone, "").trim();
    }

    rows.push({ name: canonicalName || name, district, address, phone });
  }

  if (!rows.length) {
    return { rows: [], httpStatus, error: "no_inline_box_data" };
  }

  return { rows, httpStatus, error: null };
}

// Istanbul / Yalova POST API helper
export async function fetchIstanbulRows(endpointUrl, ilSlug) {
  let pageHtml, pageStatus;
  try {
    const page = await fetchResource(endpointUrl);
    pageHtml = page.html || "";
    pageStatus = page.status;
  } catch (err) {
    return { rows: [], httpStatus: null, error: `page_fetch: ${err.message}` };
  }

  const inputTag =
    pageHtml.match(/<input\b[^>]*\bid=["']h["'][^>]*>/is)?.[0] ??
    pageHtml.match(/<input\b[^>]*\bname=["']h["'][^>]*>/is)?.[0] ??
    null;
  const hashM = inputTag ? inputTag.match(/\bvalue=["']([^"']+)["']/i) : null;
  if (!hashM) {
    return { rows: [], httpStatus: pageStatus, error: "istanbul_hash_missing" };
  }
  const hash = hashM[1];

  const apiUrl = endpointUrl.replace(/\/?$/, "") + "/index.php";
  const apiBody = `jx=1&islem=get_eczane_markers&h=${encodeURIComponent(hash)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let json, httpStatus;
  try {
    const apiResp = await fetch(apiUrl, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "User-Agent": CRAWL_UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: endpointUrl,
        "X-Requested-With": "XMLHttpRequest"
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

  const isIstanbul = ilSlug === "istanbul";
  const eczaneler = (json.eczaneler || []).filter((e) => {
    const il = String(e.il || "").toLowerCase();
    return isIstanbul ? il.includes("stanbul") : il.includes("alova");
  });

  const rows = eczaneler
    .map((e) => ({
      name: String(e.eczane_ad || "").trim(),
      district: String(e.ilce || "").trim(),
      address: [e.mahalle, e.cadde_sokak, e.bina_kapi, e.semt]
        .map((s) => String(s || "").trim())
        .filter(Boolean)
        .join(", "),
      phone: cleanPhone(String(e.eczane_tel || ""))
    }))
    .filter((r) => r.name.length >= 3);

  return { rows, httpStatus, error: null };
}

// Osmaniye Eczacı Odası POST form helper
export async function fetchOsmaniyeHtml(endpointUrl) {
  const page = await fetchResource(endpointUrl);
  const formResult = await fetchDutyFormHtml(endpointUrl, page.html || "");
  if (formResult.usedForm && !formResult.error && formResult.html) {
    return { html: formResult.html, httpStatus: formResult.httpStatus, error: null };
  }
  return { html: page.html || "", httpStatus: page.status, error: formResult.error };
}

// Uşak usakeczaciodasi.org.tr AJAX helper
export async function fetchUsakRows(endpointUrl) {
  let pageHtml = "";
  let pageStatus = null;
  try {
    const page = await fetchResource(endpointUrl);
    pageHtml = page.html || "";
    pageStatus = page.status;
  } catch (err) {
    return { rows: [], httpStatus: null, error: `page_fetch: ${err.message}` };
  }

  const initialDate =
    pageHtml.match(/id="duty-date"\s+value="(\d{4}-\d{2}-\d{2})"/i)?.[1] ||
    pageHtml.match(/name="duty-date"\s+value="(\d{4}-\d{2}-\d{2})"/i)?.[1] ||
    resolveToday();

  const firstTry = await fetchUsakAjaxPayload(endpointUrl, initialDate);
  if (firstTry.error) {
    return { rows: [], httpStatus: firstTry.httpStatus ?? pageStatus, error: firstTry.error };
  }
  if (firstTry.rows.length) {
    return { rows: firstTry.rows, httpStatus: firstTry.httpStatus ?? pageStatus, error: null };
  }

  // Endpoint sometimes redirects older date to selected_date.
  if (firstTry.payload?.redirected || firstTry.payload?.success === false) {
    const redirectedDate =
      String(firstTry.payload?.selected_date || "")
        .trim()
        .match(/^\d{4}-\d{2}-\d{2}$/)?.[0] || resolveToday();

    if (redirectedDate !== initialDate) {
      const secondTry = await fetchUsakAjaxPayload(endpointUrl, redirectedDate);
      if (secondTry.error) {
        return { rows: [], httpStatus: secondTry.httpStatus ?? firstTry.httpStatus ?? pageStatus, error: secondTry.error };
      }
      if (secondTry.rows.length) {
        return { rows: secondTry.rows, httpStatus: secondTry.httpStatus ?? firstTry.httpStatus ?? pageStatus, error: null };
      }
    }
  }

  return { rows: [], httpStatus: firstTry.httpStatus ?? pageStatus, error: "usak_ajax_no_rows" };
}

async function fetchUsakAjaxPayload(endpointUrl, dutyDate) {
  const ajaxUrl = `${endpointUrl}?date=${encodeURIComponent(dutyDate)}&_=${Date.now()}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  let httpStatus = null;
  try {
    const resp = await fetch(ajaxUrl, {
      method: "GET",
      signal: ctrl.signal,
      headers: {
        "User-Agent": CRAWL_UA,
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Referer: endpointUrl
      },
      cache: "no-store"
    });

    httpStatus = resp.status;
    const text = await resp.text();
    const payload = JSON.parse(text);
    const rows = normalizeUsakRows(payload);
    return { rows, httpStatus, error: null, payload };
  } catch (err) {
    const message = String(err?.message || "");
    const kind = message.includes("Unexpected token") ? "usak_ajax_invalid_json" : `usak_ajax_fetch: ${message}`;
    return { rows: [], httpStatus, error: kind, payload: null };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeUsakRows(payload) {
  if (!payload || typeof payload !== "object") return [];

  const rawRows =
    Array.isArray(payload.data) ? payload.data :
    Array.isArray(payload.eczaneler) ? payload.eczaneler :
    Array.isArray(payload.rows) ? payload.rows :
    [];

  if (!rawRows.length) return [];

  return rawRows
    .map((item) => {
      const pharmacy = item?.pharmacy || {};
      const rawName = String(pharmacy.name || item?.name || "").trim();
      const district = String(pharmacy.district || item?.district || "").trim();
      const address = String(pharmacy.adres || item?.description || "").trim();
      const phone = cleanPhone(String(pharmacy.gsm || pharmacy.phone || item?.phone || ""));
      const hasSuffix = /\becz/i.test(rawName);
      const name = hasSuffix ? rawName : `${rawName} ECZANESİ`;
      return {
        name,
        district,
        address,
        phone
      };
    })
    .filter((row) => row.name.length >= 3);
}

function isTransientFetchError(err) {
  const name = String(err?.name || "").toLowerCase();
  const msg = String(err?.message || "").toLowerCase();
  return (
    name.includes("abort") ||
    msg.includes("aborted") ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("fetch failed") ||
    msg.includes("socket") ||
    msg.includes("network")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveTodayTrDotted() {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date());
}

function selectDutyForm(html) {
  if (!html) return null;

  const formRe = /<form\b[^>]*>[\s\S]*?<\/form>/gi;
  let match;
  let best = null;

  while ((match = formRe.exec(html)) !== null) {
    const formHtml = match[0];
    const openTag = formHtml.match(/<form\b[^>]*>/i)?.[0] || "";
    const method = String(getAttr(openTag, "method") || "POST").toUpperCase();
    const action = String(getAttr(openTag, "action") || "");
    const score = scoreDutyForm(formHtml, action);
    if (score <= 0) continue;

    const candidate = { html: formHtml, method, action, score };
    if (!best || candidate.score > best.score) {
      best = candidate;
    }
  }

  return best;
}

function scoreDutyForm(formHtml, action = "") {
  const text = foldTr(stripTags(formHtml)).toUpperCase();
  const normalizedHtml = foldTr(formHtml).toUpperCase();
  const actionNorm = foldTr(action).toLowerCase();
  let score = 0;

  if (/NOBETLERI\s+GOSTER/.test(text)) score += 8;
  if (/NOBETCI/.test(text) && /GOSTER/.test(text)) score += 3;
  if (/NOBET\s+KARTI\s+YAZDIR/.test(text) && !/NOBETLERI\s+GOSTER/.test(text)) score -= 5;
  if (/TYPE=["']SUBMIT["'][^>]{0,140}VALUE=["'][^"']*GOSTER/.test(normalizedHtml)) score += 8;
  if (/VALUE=["'][^"']*GOSTER[^"']*["'][^>]{0,140}TYPE=["']SUBMIT/.test(normalizedHtml)) score += 8;
  if (
    /TYPE=["']SUBMIT["'][^>]{0,140}VALUE=["'][^"']*YAZDIR/.test(normalizedHtml) &&
    !/GOSTER/.test(normalizedHtml)
  ) {
    score -= 8;
  }
  if (/name=["'][^"']*(tarih|date)[^"']*["']/i.test(formHtml)) score += 2;
  if (/name=["'][^"']*(ilce|district|bolge)[^"']*["']/i.test(formHtml)) score += 1;
  if (!actionNorm || actionNorm === "#" || actionNorm === "./") score += 1;
  if (actionNorm.includes("nobetkarti")) score -= 12;

  return score;
}

function buildDutyFormPayload(formHtml) {
  const payload = new URLSearchParams();

  const inputRe = /<input\b[^>]*>/gi;
  let inputMatch;
  let submitChosen = false;
  while ((inputMatch = inputRe.exec(formHtml)) !== null) {
    const tag = inputMatch[0];
    const name = getAttr(tag, "name");
    if (!name) continue;

    const type = String(getAttr(tag, "type") || "text").toLowerCase();
    if (type === "button" || type === "reset" || type === "file" || type === "image") continue;
    if ((type === "checkbox" || type === "radio") && !/\bchecked\b/i.test(tag)) continue;

    let value = String(getAttr(tag, "value") || "");
    if (type === "submit") {
      const normalized = foldTr(value).toUpperCase();
      if (/NOBETLERI\s+GOSTER/.test(normalized)) {
        submitChosen = true;
      } else if (submitChosen) {
        continue;
      }
    }

    if (/(tarih|date|gun|day)/i.test(name)) {
      value = coerceDateValue(value);
    }

    payload.set(name, value);
  }

  const selectRe = /<select\b[^>]*>[\s\S]*?<\/select>/gi;
  let selectMatch;
  while ((selectMatch = selectRe.exec(formHtml)) !== null) {
    const full = selectMatch[0];
    const openTag = full.match(/^<select\b[^>]*>/i)?.[0] || "";
    const name = getAttr(openTag, "name");
    if (!name) continue;

    const selected = pickSelectValue(full);
    payload.set(name, selected);
  }

  if (!payload.toString()) return null;
  return payload;
}

function pickSelectValue(selectHtml) {
  const optionRe = /<option\b[^>]*>([\s\S]*?)<\/option>/gi;
  let optionMatch;
  const options = [];

  while ((optionMatch = optionRe.exec(selectHtml)) !== null) {
    const optionTag = optionMatch[0];
    const text = cleanOptionText(optionMatch[1]);
    const value = String(getAttr(optionTag, "value") ?? text).trim();
    const selected = /\bselected\b/i.test(optionTag);
    options.push({ value, text, selected });
  }

  if (!options.length) return "";

  const allOption = options.find((o) => isAllOption(o.value, o.text));
  if (allOption) return allOption.value;

  const selected = options.find((o) => o.selected);
  if (selected) return selected.value;

  return options[0].value;
}

function coerceDateValue(raw) {
  const value = String(raw || "").trim();
  const todayIso = resolveToday();
  const todayDot = resolveTodayTrDotted();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return todayIso;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return todayDot;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return todayDot.replace(/\./g, "/");
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return todayDot.replace(/\./g, "-");
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(value)) return todayIso.replace(/-/g, "/");

  return todayDot;
}

function isAllOption(value, text) {
  const norm = foldTr(`${value} ${text}`).toUpperCase().trim();
  return (
    norm === "" ||
    norm === "0" ||
    norm.includes("TUMU") ||
    norm.includes("HEPSI") ||
    norm.includes("ALL")
  );
}

function resolveActionUrl(endpointUrl, action) {
  if (!action) return endpointUrl;
  try {
    return new URL(action, endpointUrl).toString();
  } catch {
    return endpointUrl;
  }
}

function appendQuery(url, query) {
  if (!query) return url;
  return url.includes("?") ? `${url}&${query}` : `${url}?${query}`;
}

function getAttr(tag, attr) {
  const quoted = tag.match(new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, "i"));
  if (quoted) return quoted[1];
  const unquoted = tag.match(new RegExp(`${attr}\\s*=\\s*([^\\s>]+)`, "i"));
  if (unquoted) return unquoted[1];
  return null;
}

function cleanOptionText(text) {
  return stripTags(String(text || ""))
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(text) {
  return String(text || "").replace(/<[^>]+>/g, " ");
}

function foldTr(text) {
  return String(text || "")
    .replace(/[İıi]/g, "i")
    .replace(/[Ğğ]/g, "g")
    .replace(/[Şş]/g, "s")
    .replace(/[Çç]/g, "c")
    .replace(/[Öö]/g, "o")
    .replace(/[Üü]/g, "u");
}
