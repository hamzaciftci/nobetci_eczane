import { cleanPhone } from "./utils.js";

export const FETCH_TIMEOUT_MS = 10_000;
export const CRAWL_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0";

export async function fetchResource(url) {
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
  } finally {
    clearTimeout(timer);
  }
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
