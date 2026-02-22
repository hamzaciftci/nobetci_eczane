import { ISTANBUL_TZ, toSlug } from "@nobetci/shared";
import { DateTime } from "luxon";
import { load } from "cheerio";
import { SourceEndpointConfig } from "../core/types";

type DateValidationStatus = "valid" | "missing" | "outdated";

interface DateExtractResult {
  scrapedDate: string | null;
  source: string;
}

export interface ScrapedDateValidationResult {
  expectedDate: string;
  acceptedDates: string[];
  scrapedDate: string | null;
  status: DateValidationStatus;
  isValid: boolean;
  strict: boolean;
  source: string;
}

export class OutdatedSourceDateError extends Error {
  constructor(
    readonly endpoint: SourceEndpointConfig,
    readonly details: ScrapedDateValidationResult
  ) {
    const mode = details.status === "missing" ? "missing date" : "outdated date";
    super(
      `Source date validation failed (${mode}) for ${endpoint.provinceSlug}:${endpoint.sourceName} - expected=${details.expectedDate}, accepted=${details.acceptedDates.join(",")}, scraped=${details.scrapedDate ?? "n/a"}`
    );
    this.name = "OutdatedSourceDateError";
  }
}

const TURKISH_MONTH_MAP: Record<string, number> = {
  ocak: 1,
  subat: 2,
  mart: 3,
  nisan: 4,
  mayis: 5,
  haziran: 6,
  temmuz: 7,
  agustos: 8,
  eylul: 9,
  ekim: 10,
  kasim: 11,
  aralik: 12
};

const DEFAULT_DATE_SELECTORS = [
  ".baslik",
  ".date",
  ".tarih",
  ".nobet-date",
  ".nobet-tarih",
  "h1",
  "h2",
  "h3",
  "time",
  "title"
];

const PARSER_DATE_SELECTORS: Record<string, string[]> = {
  osmaniye_eo_v1: ["div.baslik", ".baslik", "title"],
  adana_primary_v1: [".dynamicTable", "h1", "h2", "h3", "title"],
  adana_secondary_v1: [".nobetci", "h1", "h2", "h3", "title"],
  istanbul_primary_v1: ["h1", "h2", "h3", "title"],
  istanbul_secondary_v1: ["h1", "h2", "h3", "title"],
  tokat_schedule_v1: ["table", "h1", "h2", "h3", "title"],
  generic_auto_v1: DEFAULT_DATE_SELECTORS,
  generic_table: DEFAULT_DATE_SELECTORS,
  generic_list: DEFAULT_DATE_SELECTORS
};

const DEFAULT_STRICT_KEYS = new Set<string>(["osmaniye_eo_v1"]);

export function validateScrapedDate(
  html: string,
  endpoint: SourceEndpointConfig
): ScrapedDateValidationResult {
  const expectedDate = DateTime.now().setZone(ISTANBUL_TZ).toISODate() ?? "";
  const acceptedDates = resolveAcceptedDates();
  const strict = resolveStrictMode(endpoint);
  const extracted = extractScrapedDate(html, endpoint);

  if (!extracted.scrapedDate) {
    return {
      expectedDate,
      acceptedDates,
      scrapedDate: null,
      status: "missing",
      isValid: !strict,
      strict,
      source: extracted.source
    };
  }

  if (!acceptedDates.includes(extracted.scrapedDate)) {
    return {
      expectedDate,
      acceptedDates,
      scrapedDate: extracted.scrapedDate,
      status: "outdated",
      isValid: false,
      strict,
      source: extracted.source
    };
  }

  return {
    expectedDate,
    acceptedDates,
    scrapedDate: extracted.scrapedDate,
    status: "valid",
    isValid: true,
    strict,
    source: extracted.source
  };
}

function extractScrapedDate(html: string, endpoint: SourceEndpointConfig): DateExtractResult {
  const $ = load(html);
  const selectors = PARSER_DATE_SELECTORS[endpoint.parserKey] ?? DEFAULT_DATE_SELECTORS;
  const inspected = new Set<string>();

  for (const selector of selectors) {
    $(selector)
      .slice(0, 8)
      .each((_, node) => {
        const text = cleanText($(node).text());
        if (text) {
          inspected.add(text);
        }
      });
  }

  const keywordContexts = collectKeywordContexts(cleanText($("body").text()));
  for (const value of keywordContexts) {
    inspected.add(value);
  }

  for (const value of inspected) {
    const parsed = parseDateFromText(value);
    if (parsed) {
      return {
        scrapedDate: parsed,
        source: "html-selector"
      };
    }
  }

  return {
    scrapedDate: null,
    source: "not-found"
  };
}

function collectKeywordContexts(bodyText: string): string[] {
  if (!bodyText) {
    return [];
  }

  const contexts: string[] = [];
  const regex = /(.{0,80}(?:n[oö]bet[cç]i|g[uü]n[uü]|tarih).{0,80})/gim;

  for (const match of bodyText.matchAll(regex)) {
    const context = cleanText(match[1] ?? "");
    if (context) {
      contexts.push(context);
    }
  }

  if (!contexts.length) {
    return [bodyText.slice(0, 800)];
  }

  return contexts.slice(0, 24);
}

function parseDateFromText(value: string): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return null;
  }

  const numericMatch = cleaned.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (numericMatch) {
    return toIsoDate(Number(numericMatch[3]), Number(numericMatch[2]), Number(numericMatch[1]));
  }

  const monthMatch = cleaned.match(/\b(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})\b/i);
  if (!monthMatch) {
    return null;
  }

  const day = Number(monthMatch[1]);
  const monthName = toSlug(monthMatch[2] ?? "");
  const month = TURKISH_MONTH_MAP[monthName];
  const year = Number(monthMatch[3]);

  if (!month) {
    return null;
  }

  return toIsoDate(year, month, day);
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function resolveStrictMode(endpoint: SourceEndpointConfig): boolean {
  if (process.env.STRICT_SCRAPED_DATE_VALIDATION === "1") {
    return true;
  }

  if (DEFAULT_STRICT_KEYS.has(endpoint.parserKey)) {
    return true;
  }

  const strictKeysRaw = cleanText(process.env.STRICT_SCRAPED_DATE_KEYS ?? "");
  if (!strictKeysRaw) {
    return false;
  }

  return strictKeysRaw
    .split(",")
    .map((item) => cleanText(item))
    .filter(Boolean)
    .includes(endpoint.parserKey);
}

function resolveAcceptedDates(now = DateTime.now().setZone(ISTANBUL_TZ)): string[] {
  const today = now.toISODate();
  if (!today) {
    return [];
  }

  if (now.hour < 8) {
    const yesterday = now.minus({ days: 1 }).toISODate();
    if (yesterday) {
      return [today, yesterday];
    }
  }

  return [today];
}

function cleanText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
