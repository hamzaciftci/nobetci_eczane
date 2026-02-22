import { createHash } from "crypto";
import { ISTANBUL_TZ, normalizePharmacyName, resolveActiveDutyWindow, toSlug } from "@nobetci/shared";
import { load } from "cheerio";
import { DateTime } from "luxon";
import { SourceAdapter } from "./adapter.interface";
import { AdapterFetchResult, SourceBatch, SourceEndpointConfig, SourceRecord } from "../core/types";
import { parseHtmlToSourceRecords } from "../parsers/html-parser";
import { TURKIYE_DISTRICT_LEXICON } from "../parsers/tr-districts";
import {
  OutdatedSourceDateError,
  ScrapedDateValidationResult,
  validateScrapedDate
} from "../parsers/date-validation";

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
    if (isAnkaraAeoEndpoint(endpoint)) {
      return fetchAnkaraNobetData(endpoint);
    }

    const freshness = await fetchFreshPayload(endpoint, conditionalHeaders);
    const { response, dateValidation, fetchUrl } = freshness;

    let records = parseJsonToSourceRecords(response.body, endpoint);
    if (!records.length) {
      records = parseHtmlToSourceRecords(response.body, endpoint);
    }

    if (shouldFetchDistrictForms(response.body, records)) {
      const formRecords = await fetchDistrictFormRecords(endpoint, response.body, conditionalHeaders);
      records = mergeSourceRecords(records, formRecords);
    }

    if (!records.length && isAydinEndpoint(endpoint.endpointUrl)) {
      records = await fetchAydinPostRecords(endpoint, response.body, conditionalHeaders);
    }
    if (!records.length) {
      records = await fetchRelatedRecords(endpoint, response.body);
    }

    records = normalizeSourceRecordDistricts(records, endpoint.provinceSlug);
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
      rawPayload: response.body,
      dateValidation,
      fetchUrl
    };
  }
}

async function fetchFreshPayload(
  endpoint: SourceEndpointConfig,
  conditionalHeaders: Record<string, string>
): Promise<{ response: FetchResult; dateValidation?: ScrapedDateValidationResult; fetchUrl: string }> {
  let response = await fetchEndpoint(endpoint.endpointUrl, conditionalHeaders);
  if (response.statusCode === 304) {
    // Some upstream APIs return 304 aggressively; retry without conditional headers to avoid stale runs.
    response = await fetchEndpoint(endpoint.endpointUrl);
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Source responded with status ${response.statusCode}`);
  }

  if (!isHtmlFormat(endpoint.format)) {
    return {
      response,
      fetchUrl: endpoint.endpointUrl
    };
  }

  let validation = validateScrapedDate(response.body, endpoint);
  if (validation.isValid) {
    return {
      response,
      dateValidation: validation,
      fetchUrl: endpoint.endpointUrl
    };
  }

  const retryUrl = appendCacheBuster(endpoint.endpointUrl);
  const retried = await fetchEndpoint(retryUrl);
  if (retried.statusCode < 200 || retried.statusCode >= 300) {
    throw new Error(
      `Source date mismatch and retry failed with status ${retried.statusCode} (expected ${validation.expectedDate}, scraped ${validation.scrapedDate ?? "n/a"})`
    );
  }

  validation = validateScrapedDate(retried.body, endpoint);
  if (!validation.isValid) {
    throw new OutdatedSourceDateError(endpoint, validation);
  }

  return {
    response: retried,
    dateValidation: validation,
    fetchUrl: retryUrl
  };
}

async function fetchIstanbulNobetData(
  endpoint: SourceEndpointConfig,
  conditionalHeaders: Record<string, string> = {}
): Promise<AdapterFetchResult> {
  const page = await fetch(endpoint.endpointUrl, {
    method: "GET",
    cache: "no-store",
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
      const key = buildRecordKey(record);
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
    fetchUrl: endpoint.endpointUrl,
    rawPayload: JSON.stringify({
      source: endpoint.endpointUrl,
      district_count: districts.length,
      record_count: records.length
    })
  };
}

function isAnkaraAeoEndpoint(endpoint: SourceEndpointConfig): boolean {
  if (endpoint.provinceSlug !== "ankara") {
    return false;
  }

  let hostname = "";
  try {
    hostname = new URL(endpoint.endpointUrl).hostname;
  } catch {
    return false;
  }

  return /(?:^|\.)aeo\.org\.tr/i.test(hostname) && /\/nobetci-eczaneler/i.test(endpoint.endpointUrl);
}

async function fetchAnkaraNobetData(endpoint: SourceEndpointConfig): Promise<AdapterFetchResult> {
  const now = DateTime.now().setZone(ISTANBUL_TZ);
  const startDate = now.startOf("day");
  const futureDays = Math.max(0, Number(process.env.ANKARA_AEO_FUTURE_DAYS ?? 6));
  const maxDays = Math.min(14, futureDays);

  const dedupe = new Map<string, SourceRecord>();
  const payloadByDate: Record<string, { status: string; count: number; url: string }> = {};
  let lastStatus = 200;

  for (let offset = 0; offset <= maxDays; offset += 1) {
    const dutyDate = startDate.plus({ days: offset }).toISODate();
    if (!dutyDate) {
      continue;
    }

    const url = new URL(`/getPharmacies/${dutyDate}`, endpoint.endpointUrl).toString();
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: defaultHeaders()
    });
    lastStatus = response.status;
    if (!response.ok) {
      payloadByDate[dutyDate] = {
        status: `http_${response.status}`,
        count: 0,
        url
      };
      continue;
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payloadByDate[dutyDate] = {
        status: "invalid_json",
        count: 0,
        url
      };
      continue;
    }

    const parsed = payload as { status?: string; html?: string };
    const html = cleanText(String(parsed?.html ?? "")) ? String(parsed?.html ?? "") : "";
    if (!html) {
      payloadByDate[dutyDate] = {
        status: parsed?.status ?? "empty_html",
        count: 0,
        url
      };
      continue;
    }

    const records = parseHtmlToSourceRecords(
      html,
      {
        ...endpoint,
        endpointUrl: url,
        parserKey: "generic_auto_v1"
      },
      {
        dutyDateOverride: dutyDate
      }
    );

    for (const record of records) {
      const key = buildRecordKey(record);
      if (!dedupe.has(key)) {
        dedupe.set(key, record);
      }
    }

    payloadByDate[dutyDate] = {
      status: parsed?.status ?? "ok",
      count: records.length,
      url
    };
  }

  const records = normalizeSourceRecordDistricts([...dedupe.values()], endpoint.provinceSlug);
  if (!records.length) {
    throw new Error("Ankara parser produced zero records");
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
    httpStatus: lastStatus,
    fetchUrl: endpoint.endpointUrl,
    rawPayload: JSON.stringify({
      source: endpoint.endpointUrl,
      date_count: Object.keys(payloadByDate).length,
      record_count: records.length,
      payload_by_date: payloadByDate
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
    cache: "no-store",
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
    cache: "no-store",
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
        cache: "no-store",
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
          const key = buildRecordKey(record);
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

function shouldFetchDistrictForms(baseHtml: string, records: SourceRecord[]): boolean {
  if (!/<select[^>]+(?:name|id)=["'][^"']*ilce/i.test(baseHtml)) {
    return false;
  }

  if (!records.length) {
    return true;
  }

  const distinct = new Set(records.map((record) => record.districtSlug).filter(Boolean));
  return distinct.size <= 1;
}

async function fetchDistrictFormRecords(
  endpoint: SourceEndpointConfig,
  baseHtml: string,
  conditionalHeaders: Record<string, string> = {}
): Promise<SourceRecord[]> {
  const $ = load(baseHtml);
  const form = $("form").filter((_, formEl) => $(formEl).find("select[name*='ilce'], select[id*='ilce']").length > 0).first();
  if (!form.length) {
    return [];
  }

  const select = form.find("select[name*='ilce'], select[id*='ilce']").first();
  const selectName = cleanText(String(select.attr("name") ?? select.attr("id") ?? "ilce")) || "ilce";
  const rawOptions = select
    .find("option")
    .map((_, option) => {
      const value = cleanText(String($(option).attr("value") ?? ""));
      const label = cleanText($(option).text()) || value;
      return { value, label };
    })
    .get() as Array<{ value: string; label: string }>;

  const optionEntries = [
    ...new Map(
      rawOptions
        .filter((entry) => {
          const label = entry.label.toLocaleLowerCase("tr-TR");
          return Boolean(
            entry.value &&
              entry.value !== "0" &&
              !label.includes("ilce seciniz") &&
              !label.includes("ilçe seçiniz") &&
              !label.includes("tum ilceler") &&
              !label.includes("tüm ilçeler") &&
              !label.includes("hepsi")
          );
        })
        .map((entry) => [entry.value, entry] as const)
    ).values()
  ];

  if (!optionEntries.length) {
    return [];
  }

  const action = cleanText(String(form.attr("action") ?? ""));
  const postUrl = toAbsoluteUrl(endpoint.endpointUrl, action || endpoint.endpointUrl) ?? endpoint.endpointUrl;
  const hidden = readHiddenInputs($, form);
  const dutyDate = resolveActiveDutyWindow().dutyDate;
  const dutyDateTr = formatDutyDateForLegacyForms(dutyDate);
  const parserCandidates = new Set<string>([endpoint.parserKey, "generic_auto_v1", "generic_list", "generic_table"]);
  const maxDistrictRequests = Number(process.env.FORM_FETCH_MAX_DISTRICTS ?? 120);
  const knownDistricts = getKnownDistricts(endpoint.provinceSlug);
  const dedupe = new Map<string, SourceRecord>();

  const pageResponse = await fetch(endpoint.endpointUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      ...defaultHeaders(),
      ...conditionalHeaders
    }
  });
  const cookieHeader = extractCookieHeader(pageResponse.headers.get("set-cookie"));

  for (const optionEntry of optionEntries.slice(0, maxDistrictRequests)) {
    const districtValue = optionEntry.value;
    const districtHint = pickCanonicalDistrictName(optionEntry.label, optionEntry.label, knownDistricts);
    const payload = new URLSearchParams();
    for (const [key, value] of Object.entries(hidden)) {
      payload.set(key, value);
    }
    payload.set(selectName, districtValue);
    injectDatePayload(payload, dutyDate, dutyDateTr);

    try {
      const response = await fetch(postUrl, {
        method: "POST",
        cache: "no-store",
        headers: {
          ...defaultHeaders(),
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          ...(cookieHeader ? { cookie: cookieHeader } : {})
        },
        body: payload
      });
      if (!response.ok) {
        continue;
      }

      const body = await response.text();
      if (!body || isPdfLike(body, postUrl)) {
        continue;
      }

      const htmlPayloads = extractHtmlFromPayload(body);
      const parsePayloads = htmlPayloads.length ? htmlPayloads : [body];

      for (const htmlPayload of parsePayloads) {
        for (const parserKey of parserCandidates) {
          const records = withDistrictFallback(
            parseHtmlToSourceRecords(htmlPayload, {
              ...endpoint,
              endpointUrl: postUrl,
              parserKey
            }),
            districtHint,
            knownDistricts
          );

          for (const record of records) {
            const key = buildRecordKey(record);
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
      // keep partial district successes
    }
  }

  return [...dedupe.values()];
}

function mergeSourceRecords(base: SourceRecord[], incoming: SourceRecord[]): SourceRecord[] {
  if (!incoming.length) {
    return base;
  }

  const map = new Map<string, SourceRecord>();
  for (const record of [...base, ...incoming]) {
    const key = buildRecordKey(record);
    if (!map.has(key)) {
      map.set(key, record);
    }
  }

  return [...map.values()];
}

function normalizeSourceRecordDistricts(records: SourceRecord[], provinceSlug: string): SourceRecord[] {
  const knownDistricts = getKnownDistricts(provinceSlug);
  if (!knownDistricts.length || !records.length) {
    return records;
  }

  return records.map((record) => {
    const districtName = pickCanonicalDistrictName(
      record.districtName,
      `${record.districtName} ${record.pharmacyName} ${record.address}`,
      knownDistricts
    );

    return {
      ...record,
      districtName,
      districtSlug: toSlug(districtName)
    };
  });
}

function pickCanonicalDistrictName(current: string, text: string, knownDistricts: readonly string[]): string {
  const cleaned = cleanText(current);
  const currentSlug = toSlug(cleaned);
  if (currentSlug) {
    const exact = knownDistricts.find((item) => toSlug(item) === currentSlug);
    if (exact) {
      return exact;
    }
  }

  const fromText = findDistrictFromText(text, knownDistricts);
  if (fromText) {
    return fromText;
  }

  if (isGenericDistrictName(cleaned)) {
    return "Merkez";
  }

  if (isNoiseDistrictName(cleaned)) {
    return "Merkez";
  }

  if (!isKnownDistrictName(cleaned, knownDistricts)) {
    return "Merkez";
  }

  return cleaned;
}

function findDistrictFromText(text: string, knownDistricts: readonly string[]): string {
  const normalizedText = toSlug(text);
  if (!normalizedText) {
    return "";
  }

  const tokens = normalizedText.split(/[^a-z0-9]+/).filter(Boolean);
  const sorted = [...knownDistricts].sort((a, b) => toSlug(b).length - toSlug(a).length);
  for (const district of sorted) {
    const districtSlug = toSlug(district);
    if (!districtSlug) {
      continue;
    }

    if (districtSlug.length <= 3) {
      if (tokens.includes(districtSlug)) {
        return district;
      }
      continue;
    }

    if (
      normalizedText === districtSlug ||
      normalizedText.startsWith(`${districtSlug}-`) ||
      normalizedText.endsWith(`-${districtSlug}`) ||
      normalizedText.includes(`-${districtSlug}-`) ||
      normalizedText.includes(districtSlug)
    ) {
      return district;
    }
  }

  return "";
}

function isNoiseDistrictName(value: string): boolean {
  if (!value) {
    return true;
  }

  const normalized = toSlug(value);
  if (!normalized) {
    return true;
  }

  if (
    normalized.includes("nobetci") ||
    normalized.includes("eczane") ||
    normalized.includes("aile-sagligi") ||
    normalized.includes("saglik-ocagi") ||
    normalized.includes("hastane") ||
    normalized.includes("tip-merkezi") ||
    normalized.includes("asm") ||
    normalized.includes("nolu")
  ) {
    return true;
  }

  return false;
}

function withDistrictFallback(
  records: SourceRecord[],
  districtHint: string,
  knownDistricts: readonly string[]
): SourceRecord[] {
  if (!records.length) {
    return records;
  }

  const canonicalHint = pickCanonicalDistrictName(districtHint, districtHint, knownDistricts);
  if (!canonicalHint || isGenericDistrictName(canonicalHint)) {
    return records;
  }

  return records.map((record) => {
    const canonical = pickCanonicalDistrictName(
      record.districtName,
      `${record.districtName} ${record.pharmacyName} ${record.address}`,
      knownDistricts
    );

    if (canonical && canonical !== "Merkez" && isKnownDistrictName(canonical, knownDistricts)) {
      return {
        ...record,
        districtName: canonical,
        districtSlug: toSlug(canonical)
      };
    }

    return {
      ...record,
      districtName: canonicalHint,
      districtSlug: toSlug(canonicalHint)
    };
  });
}

function isKnownDistrictName(value: string, knownDistricts: readonly string[]): boolean {
  const slug = toSlug(value);
  if (!slug) {
    return false;
  }

  return knownDistricts.some((item) => toSlug(item) === slug);
}

function isGenericDistrictName(value: string): boolean {
  const normalized = toSlug(value);
  return !normalized || normalized === "merkez" || normalized === "merkez-ilce" || normalized === "merkez-ilcesi";
}

function getKnownDistricts(provinceSlug: string): string[] {
  const base = TURKIYE_DISTRICT_LEXICON[provinceSlug] ?? [];
  const extras = EXTRA_DISTRICT_ALIASES[provinceSlug] ?? [];
  return [...new Set([...base, ...extras])];
}

function readHiddenInputs($: any, form: any) {
  const values: Record<string, string> = {};
  form.find("input[type='hidden'][name]").each((_index: number, input: any) => {
    const key = cleanText(String($(input).attr("name") ?? ""));
    const value = cleanText(String($(input).attr("value") ?? ""));
    if (key) {
      values[key] = value;
    }
  });
  return values;
}

function injectDatePayload(payload: URLSearchParams, dutyDateIso: string, dutyDateTr: string) {
  const dateKeys = ["tarih", "tarih1", "date", "selectedDate", "gun", "nobetTarihi"];
  for (const key of dateKeys) {
    if (!payload.has(key)) {
      continue;
    }

    const current = cleanText(payload.get(key) ?? "");
    if (!current) {
      payload.set(key, dutyDateTr);
      continue;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(current)) {
      payload.set(key, dutyDateIso);
      continue;
    }

    payload.set(key, dutyDateTr);
  }

  if (!payload.has("tarih")) {
    payload.set("tarih", dutyDateTr);
  }
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
            const key = buildRecordKey(record);
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
    "accept-language": "tr-TR,tr;q=0.9,en;q=0.8",
    pragma: "no-cache",
    "cache-control": "no-cache, no-store, max-age=0"
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
      cache: "no-store",
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

function buildRecordKey(record: Pick<SourceRecord, "dutyDate" | "districtSlug" | "normalizedName">): string {
  return `${record.dutyDate}:${record.districtSlug}:${record.normalizedName}`;
}

function isHtmlFormat(format: SourceEndpointConfig["format"]): boolean {
  return format === "html" || format === "html_js" || format === "html_table";
}

function appendCacheBuster(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("_ts", String(Date.now()));
  return parsed.toString();
}

const EXTRA_DISTRICT_ALIASES: Record<string, readonly string[]> = {
  adana: ["Salbaş"]
};
