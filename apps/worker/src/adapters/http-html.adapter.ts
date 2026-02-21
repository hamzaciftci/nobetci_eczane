import { createHash } from "crypto";
import { normalizePharmacyName, resolveActiveDutyWindow, toSlug } from "@nobetci/shared";
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
    return format === "html" || format === "html_table" || format === "html_js";
  }

  async fetch(
    endpoint: SourceEndpointConfig,
    conditionalHeaders: Record<string, string> = {}
  ): Promise<AdapterFetchResult> {
    if (endpoint.parserKey === "istanbul_secondary_v1" && endpoint.endpointUrl.includes("istanbuleczaciodasi.org.tr")) {
      return fetchIstanbulNobetData(endpoint, conditionalHeaders);
    }

    const response = await fetchEndpoint(endpoint.endpointUrl, conditionalHeaders);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Source responded with status ${response.statusCode}`);
    }

    const records = parseHtmlToSourceRecords(response.body, endpoint);
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
    "user-agent": "NobetciEczaneBot/1.0 (+https://example.com/bot-policy)",
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
