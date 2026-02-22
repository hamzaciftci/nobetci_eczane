import { createHash } from "crypto";
import { normalizePharmacyName, resolveActiveDutyWindow, toSlug } from "@nobetci/shared";
import { load } from "cheerio";
import { SourceAdapter } from "./adapter.interface";
import { AdapterFetchResult, SourceBatch, SourceEndpointConfig, SourceRecord } from "../core/types";
import { parseHtmlToSourceRecords } from "../parsers/html-parser";

interface FetchResult {
  statusCode: number;
  body: string;
  etag: string | null;
  lastModified: string | null;
}

export class HttpHtmlAdapter implements SourceAdapter {
  supports(format: SourceEndpointConfig["format"]): boolean {
    return format === "html" || format === "html_table" || format === "html_js" || format === "api";
  }

  async fetch(
    endpoint: SourceEndpointConfig,
    conditionalHeaders: Record<string, string> = {}
  ): Promise<AdapterFetchResult> {
    if (endpoint.parserKey === "istanbul_secondary_v1" && endpoint.endpointUrl.includes("istanbuleczaciodasi.org.tr")) {
      return fetchIstanbulNobetData(endpoint, conditionalHeaders);
    }

    let response = await fetchEndpoint(endpoint.endpointUrl, conditionalHeaders);
    if (response.statusCode === 304) {
      // Some upstream APIs return 304 aggressively; retry without conditional headers to avoid empty ingestion runs.
      response = await fetchEndpoint(endpoint.endpointUrl);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Source responded with status ${response.statusCode}`);
    }

    let records = parseJsonToSourceRecords(response.body, endpoint);
    if (!records.length) {
      records = parseHtmlToSourceRecords(response.body, endpoint);
    }
    if (!records.length && isAydinEndpoint(endpoint.endpointUrl)) {
      records = await fetchAydinPostRecords(endpoint, response.body, conditionalHeaders);
    }
    if (!records.length) {
      records = await fetchRelatedRecords(endpoint, response.body);
    }

    records = filterProvinceScopedRecords(endpoint.provinceSlug, records);
    if (!records.length) {
      throw new Error("Parser produced zero records");
    }

    const batch: SourceBatch = {
      source: {
        sourceName: endpoint.sourceName,
        sourceType: endpoint.sourceType,
        sourceUrl: endpoint.endpointUrl,
        authorityWeight: endpoint.authorityWeight,
        sourceEndpointId: endpoint.sourceEndpointId,
        parserKey: endpoint.parserKey
      },
      records
    };

    return {
      batch,
      httpStatus: response.statusCode,
      etag: response.etag,
      lastModified: response.lastModified,
      rawPayload: response.body
    };
  }
}

async function fetchIstanbulNobetData(
  endpoint: SourceEndpointConfig,
  conditionalHeaders: Record<string, string> = {}
): Promise<AdapterFetchResult> {
  const page = await fetch(endpoint.endpointUrl, {
    method: "GET",
    headers: {
      ...defaultHeaders(),
      ...conditionalHeaders
    }
  });

  if (!page.ok) {
    throw new Error(`Istanbul source responded with status ${page.status}`);
  }

  const pageHtml = await page.text();
  const sessionToken = extractSessionToken(pageHtml);
  if (!sessionToken) {
    throw new Error("Istanbul source session token not found");
  }

  const cookieHeader = extractCookieHeader(page.headers.get("set-cookie"));
  const postUrl = new URL("index.php", endpoint.endpointUrl).toString();

  const districtPayload = await postIstanbulForm(postUrl, {
    jx: "1",
    islem: "get_ilce",
    il: "34",
    h: sessionToken
  }, cookieHeader);

  const districts = toDistrictList(districtPayload);
  if (!districts.length) {
    throw new Error("Istanbul source returned empty district list");
  }

  const fetchedAt = new Date().toISOString();
  const { dutyDate } = resolveActiveDutyWindow();
  const dedupe = new Map<string, SourceRecord>();

  for (const district of districts) {
    const districtPayloadRaw = await postIstanbulForm(postUrl, {
      jx: "1",
      islem: "get_ilce_eczane",
      il: "34",
      ilce: district,
      h: sessionToken
    }, cookieHeader);

    const records = normalizeIstanbulRecords(districtPayloadRaw, endpoint, district, dutyDate, fetchedAt);
    for (const record of records) {
      const key = `${record.districtSlug}:${record.normalizedName}`;
      if (!dedupe.has(key)) {
        dedupe.set(key, record);
      }
    }
  }

  const records = [...dedupe.values()];
  if (!records.length) {
    throw new Error("Istanbul parser produced zero records");
  }

  const batch: SourceBatch = {
    source: {
      sourceName: endpoint.sourceName,
      sourceType: endpoint.sourceType,
      sourceUrl: endpoint.endpointUrl,
      authorityWeight: endpoint.authorityWeight,
      sourceEndpointId: endpoint.sourceEndpointId,
      parserKey: endpoint.parserKey
    },
    records
  };

  return {
    batch,
    httpStatus: page.status,
    etag: page.headers.get("etag"),
    lastModified: page.headers.get("last-modified"),
    rawPayload: JSON.stringify({
      source: endpoint.endpointUrl,
      district_count: districts.length,
      record_count: records.length
    })
  };
}

async function postIstanbulForm(
  postUrl: string,
  payload: Record<string, string>,
  cookieHeader?: string
): Promise<unknown> {
  const response = await fetch(postUrl, {
    method: "POST",
    headers: {
      ...defaultHeaders(),
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
      ...(cookieHeader ? { cookie: cookieHeader } : {})
    },
    body: new URLSearchParams(payload)
  });

  if (!response.ok) {
    throw new Error(`Istanbul source form endpoint failed with status ${response.status}`);
  }

  const raw = (await response.text()).trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Istanbul source returned invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
  }
}

function parseJsonToSourceRecords(payload: string, endpoint: SourceEndpointConfig): SourceRecord[] {
  const trimmed = payload.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string, unknown>).data)
      ? ((parsed as Record<string, unknown>).data as unknown[])
      : Array.isArray((parsed as Record<string, unknown>).records)
        ? ((parsed as Record<string, unknown>).records as unknown[])
        : [];

  if (!list.length) {
    return [];
  }

  const { dutyDate } = resolveActiveDutyWindow();
  const fetchedAt = new Date().toISOString();

  return list
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => {
      const pharmacyName = ensureEczaneSuffix(
        cleanText(
          String(item.name ?? item.pharmacyName ?? item.eczane_adi ?? item.eczaneAdi ?? item.EczaneAdi ?? "")
        )
      );
      const phone = normalizePhone(String(item.phone ?? item.telefon ?? item.tel ?? item.Telefon ?? ""));
      const districtName = cleanText(
        String(item.district ?? item.ilce ?? item.districtName ?? item.ilce_adi ?? item.Ilce ?? "")
      );
      const address = cleanText(String(item.address ?? item.adres ?? item.Address ?? ""));
      const lat = toNumberOrNull(item.lat ?? item.enlem);
      const lng = toNumberOrNull(item.lng ?? item.boylam);
      const recordDate = normalizeJsonDate(String(item.date ?? item.dutyDate ?? item.duty_date ?? item.tarih ?? ""));

      if (!pharmacyName || !phone || !address) {
        return null;
      }
      if (recordDate && recordDate !== dutyDate) {
        return null;
      }

      return {
        provinceSlug: endpoint.provinceSlug,
        districtName: districtName || "Merkez",
        districtSlug: toSlug(districtName || "Merkez"),
        pharmacyName,
        normalizedName: normalizePharmacyName(pharmacyName),
        address,
        phone,
        lat,
        lng,
        dutyDate,
        fetchedAt
      } satisfies SourceRecord;
    })
    .filter((item): item is SourceRecord => Boolean(item));
}

function normalizeJsonDate(value: string): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return null;
  }

  const iso = cleaned.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const numeric = cleaned.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (!numeric) {
    return null;
  }

  const day = Number(numeric[1]);
  const month = Number(numeric[2]);
  const year = Number(numeric[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return null;
  }

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

function isAydinEndpoint(url: string): boolean {
  return /aydineczaciodasi\.org\.tr/i.test(url);
}

async function fetchAydinPostRecords(
  endpoint: SourceEndpointConfig,
  baseHtml: string,
  conditionalHeaders: Record<string, string> = {}
): Promise<SourceRecord[]> {
  const $ = load(baseHtml);
  const form = $("form[action*='nobet-karti2']").first();
  if (!form.length) {
    return [];
  }

  const action = cleanText(String(form.attr("action") ?? "nobet-karti2"));
  const postUrl = toAbsoluteUrl(endpoint.endpointUrl, action) ?? new URL("nobet-karti2", endpoint.endpointUrl).toString();
  const ilceValues = [
    ...new Set(
      form
        .find("select[name='ilce'] option")
        .map((_, option) => cleanText(String($(option).attr("value") ?? "")))
        .get()
        .filter(Boolean)
    )
  ];

  if (!ilceValues.length) {
    return [];
  }

  const pageResponse = await fetch(endpoint.endpointUrl, {
    method: "GET",
    headers: {
      ...defaultHeaders(),
      ...conditionalHeaders
    }
  });
  const cookieHeader = extractCookieHeader(pageResponse.headers.get("set-cookie"));
  const { dutyDate } = resolveActiveDutyWindow();
  const dutyDateTr = formatDutyDateForLegacyForms(dutyDate);
  const parserCandidates = new Set<string>([endpoint.parserKey, "generic_auto_v1", "osmaniye_eo_v1"]);
  const dedupe = new Map<string, SourceRecord>();

  for (const ilce of ilceValues.slice(0, 80)) {
    try {
      const response = await fetch(postUrl, {
        method: "POST",
        headers: {
          ...defaultHeaders(),
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          ...(cookieHeader ? { cookie: cookieHeader } : {})
        },
        body: new URLSearchParams({
          ilce,
          tarih1: dutyDateTr
        })
      });
      if (!response.ok) {
        continue;
      }

      const payload = await response.text();
      if (!payload || isPdfLike(payload, postUrl)) {
        continue;
      }

      for (const parserKey of parserCandidates) {
        const records = parseHtmlToSourceRecords(payload, {
          ...endpoint,
          endpointUrl: postUrl,
          parserKey
        });
        for (const record of records) {
          const key = `${record.districtSlug}:${record.normalizedName}`;
          if (!dedupe.has(key)) {
            dedupe.set(key, record);
          }
        }
        if (records.length) {
          break;
        }
      }
    } catch {
      // ignore per-district request errors and keep partial successful districts
    }
  }

  return [...dedupe.values()];
}

function formatDutyDateForLegacyForms(dutyDate: string): string {
  const [year, month, day] = dutyDate.split("-");
  return `${day}.${month}.${year}`;
}

function filterProvinceScopedRecords(provinceSlug: string, records: SourceRecord[]): SourceRecord[] {
  if (!records.length) {
    return records;
  }

  if (provinceSlug === "kilis") {
    return records.filter((record) => isKilisRecord(record));
  }

  if (provinceSlug === "gaziantep") {
    return records.filter((record) => !isKilisRecord(record));
  }

  return records;
}

function isKilisRecord(record: SourceRecord): boolean {
  const text = `${record.districtName} ${record.address}`.toLocaleLowerCase("tr-TR");
  return /kilis|musabeyli|elbeyli|polateli/.test(text);
}

async function fetchRelatedRecords(endpoint: SourceEndpointConfig, baseHtml: string): Promise<SourceRecord[]> {
  const parserCandidates = new Set<string>([endpoint.parserKey, "generic_auto_v1", "osmaniye_eo_v1"]);
  const { dutyDate } = resolveActiveDutyWindow();
  const candidates = collectRelatedUrls(baseHtml, endpoint.endpointUrl, dutyDate);

  if (!candidates.length) {
    return [];
  }

  const dedupe = new Map<string, SourceRecord>();
  const maxCandidates = Number(process.env.RELATED_FETCH_MAX_PAGES ?? 80);

  for (const candidate of candidates.slice(0, maxCandidates)) {
    try {
      const candidateResponse = await fetchEndpoint(candidate);
      if (candidateResponse.statusCode < 200 || candidateResponse.statusCode >= 300) {
        continue;
      }
      if (isPdfLike(candidateResponse.body, candidate)) {
        continue;
      }

      const fromPayload = extractHtmlFromPayload(candidateResponse.body);
      const htmlPayloads = fromPayload.length ? fromPayload : [candidateResponse.body];
      for (const htmlPayload of htmlPayloads) {
        for (const parserKey of parserCandidates) {
          const records = parseHtmlToSourceRecords(htmlPayload, {
            ...endpoint,
            endpointUrl: candidate,
            parserKey
          });
          for (const record of records) {
            const key = `${record.districtSlug}:${record.normalizedName}`;
            if (!dedupe.has(key)) {
              dedupe.set(key, record);
            }
          }
          if (records.length) {
            break;
          }
        }
      }
    } catch {
      // ignore related-page errors, main endpoint error handling remains authoritative
    }
  }

  return [...dedupe.values()];
}

function collectRelatedUrls(html: string, baseUrl: string, dutyDate: string): string[] {
  const urls = new Set<string>();
  const relatedPattern =
    /(nobetkarti|nobet-karti|nobet-karti2|nobetyazdir|nobetci-eczane|nobetci2-\d+|getpharmacies|eczanesistemi\.net\/list\/|public\/eczaneara)/i;
  const attrPattern = /<(a|form|iframe)[^>]+(?:href|action|src)=["']([^"']+)["']/gi;
  const scriptPattern = /(https?:\/\/[^\s"'<>]+|\/[^\s"'<>]+(?:nobet|eczane|getpharmacies|list\/\d+)[^\s"'<>]*)/gi;

  for (const match of html.matchAll(attrPattern)) {
    const raw = cleanText(String(match[2] ?? ""));
    if (!raw || raw.startsWith("javascript:")) {
      continue;
    }
    if (!relatedPattern.test(raw)) {
      continue;
    }
    const normalized = toAbsoluteUrl(baseUrl, raw);
    if (normalized) {
      urls.add(normalized);
    }
  }

  for (const match of html.matchAll(scriptPattern)) {
    const raw = cleanText(String(match[1] ?? ""));
    if (!raw || !relatedPattern.test(raw)) {
      continue;
    }
    const normalized = toAbsoluteUrl(baseUrl, raw);
    if (normalized) {
      urls.add(normalized);
    }
  }

  if (/getPharmacies/i.test(html) && /aeo\.org\.tr/i.test(baseUrl)) {
    const generated = toAbsoluteUrl(baseUrl, `/getPharmacies/${dutyDate}`);
    if (generated) {
      urls.add(generated);
    }
  }

  urls.delete(baseUrl);
  return [...urls];
}

function toAbsoluteUrl(baseUrl: string, rawUrl: string): string | null {
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractHtmlFromPayload(payload: string): string[] {
  const trimmed = payload.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const values = [parsed.html, parsed.data, parsed.result].filter((item): item is string => typeof item === "string");
    return values.filter((item) => item.includes("<"));
  } catch {
    return [];
  }
}

function isPdfLike(payload: string, url: string): boolean {
  return url.toLowerCase().includes(".pdf") || payload.startsWith("%PDF-");
}

function toDistrictList(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const list = (payload as { ilceler?: Array<{ ilce?: string }> }).ilceler;
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .map((item) => item?.ilce?.trim())
    .filter((item): item is string => Boolean(item));
}

function normalizeIstanbulRecords(
  payload: unknown,
  endpoint: SourceEndpointConfig,
  districtFallback: string,
  dutyDate: string,
  fetchedAt: string
): SourceRecord[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const items = (payload as { eczaneler?: Array<Record<string, unknown> | null> }).eczaneler;
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => {
      const districtValue = cleanText(String(item.ilce ?? ""));
      const districtName = districtValue || districtFallback;
      const districtSlug = toSlug(districtName || districtFallback);
      const pharmacyName = ensureEczaneSuffix(cleanText(String(item.eczane_ad ?? "")));
      const normalizedName = normalizePharmacyName(pharmacyName);
      const address = buildAddress(item, districtName || districtFallback);
      const phone = normalizePhone(String(item.eczane_tel ?? ""));
      const lat = toNumberOrNull(item.lat);
      const lng = toNumberOrNull(item.lng);

      if (!pharmacyName || !phone) {
        return null;
      }

      return {
        provinceSlug: endpoint.provinceSlug,
        districtName: districtName || districtFallback,
        districtSlug,
        pharmacyName,
        normalizedName,
        address,
        phone,
        lat,
        lng,
        dutyDate,
        fetchedAt
      } satisfies SourceRecord;
    })
    .filter((item): item is SourceRecord => Boolean(item));
}

function buildAddress(item: Record<string, unknown>, districtName: string): string {
  const rawAddress = stripHtml(String(item.adres ?? "")).replace(/^Adres:\s*/i, "");
  if (rawAddress) {
    return cleanText(rawAddress);
  }

  const parts = [
    cleanText(String(item.mahalle ?? "")),
    cleanText(String(item.cadde_sokak ?? "")),
    cleanText(String(item.bina_kapi ?? "")),
    districtName
  ].filter(Boolean);

  return parts.join(" ");
}

function ensureEczaneSuffix(value: string): string {
  if (!value) {
    return "";
  }

  return /eczane(si)?/i.test(value) ? value : `${value} Eczanesi`;
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `0${digits}`;
  }
  if (digits.length >= 11) {
    return digits.slice(0, 11);
  }
  return "";
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toNumberOrNull(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function extractSessionToken(html: string): string | null {
  const match = html.match(/id="h"\s+value="([^"]+)"/i) ?? html.match(/name="h"\s+value="([^"]+)"/i);
  return match?.[1] ?? null;
}

function extractCookieHeader(setCookieHeader: string | null): string | undefined {
  if (!setCookieHeader) {
    return undefined;
  }

  const parts = setCookieHeader.split(/, (?=[A-Za-z0-9_]+=)/g);
  const cookies = parts
    .map((part) => part.split(";")[0]?.trim())
    .filter(Boolean);

  if (!cookies.length) {
    return undefined;
  }

  return cookies.join("; ");
}

function defaultHeaders(): Record<string, string> {
  return {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "accept-language": "tr-TR,tr;q=0.9,en;q=0.8"
  };
}

export async function fetchEndpoint(
  endpointUrl: string,
  headers: Record<string, string> = {}
): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(endpointUrl, {
      method: "GET",
      headers: {
        ...defaultHeaders(),
        ...headers
      },
      signal: controller.signal
    });

    return {
      statusCode: response.status,
      body: await response.text(),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified")
    };
  } finally {
    clearTimeout(timer);
  }
}

export function checksumPayload(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
