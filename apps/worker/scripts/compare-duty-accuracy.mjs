#!/usr/bin/env node

import { load } from "cheerio";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

const SOURCE_BASE_URL = trimSlash(process.env.SOURCE_BASE_URL ?? "https://www.eczaneler.gen.tr");
const PROJECT_WEB_BASE_URL = trimSlash(
  process.env.PROJECT_WEB_BASE_URL ?? "https://nobetci-eczane-tau.vercel.app"
);
const PROJECT_API_BASE_URL_HINT = process.env.PROJECT_API_BASE_URL
  ? normalizeApiBase(process.env.PROJECT_API_BASE_URL)
  : null;

const SOURCE_TAB = (process.env.SOURCE_TAB ?? "bugun").trim().toLowerCase(); // bugun|dun|yarin
const REQUEST_TIMEOUT_MS = Number(process.env.COMPARE_REQUEST_TIMEOUT_MS ?? 20000);
const DISTRICT_CONCURRENCY = Number(process.env.COMPARE_DISTRICT_CONCURRENCY ?? 6);
const PROVINCE_CONCURRENCY = Number(process.env.COMPARE_PROVINCE_CONCURRENCY ?? 2);

const FILTER_PROVINCES = new Set(
  String(process.env.COMPARE_PROVINCES ?? "")
    .split(",")
    .map((item) => toSlugTr(item))
    .filter(Boolean)
);

async function main() {
  const startedAt = new Date();
  const mode = FILTER_PROVINCES.size ? `filtered(${[...FILTER_PROVINCES].join(",")})` : "all";
  console.log(`[compare] starting mode=${mode} tab=${SOURCE_TAB}`);

  const { apiBase, provinces } = await resolveProjectApiBase();
  console.log(`[compare] project api base: ${apiBase}`);

  const selectedProvinces = FILTER_PROVINCES.size
    ? provinces.filter((province) => FILTER_PROVINCES.has(toSlugTr(province.slug)))
    : provinces;

  if (!selectedProvinces.length) {
    throw new Error("No provinces selected for comparison");
  }

  const provinceResults = await mapLimit(selectedProvinces, PROVINCE_CONCURRENCY, async (province) => {
    try {
      return await compareProvince(province, apiBase);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[compare] province failed ${province.slug}: ${message}`);
      return {
        şehir: province.name,
        şehirSlug: province.slug,
        hata: message,
        ilçeler: []
      };
    }
  });

  const summary = buildSummary(provinceResults);
  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      sourceBaseUrl: SOURCE_BASE_URL,
      projectWebBaseUrl: PROJECT_WEB_BASE_URL,
      projectApiBaseUrl: apiBase,
      sourceTab: SOURCE_TAB,
      comparedProvinceCount: provinceResults.length,
      summary
    },
    provinces: provinceResults
  };

  const reportsDir = path.join(REPO_ROOT, "reports");
  await mkdir(reportsDir, { recursive: true });

  const stamp = toFileStamp(new Date());
  const reportPath = path.join(reportsDir, `comparison-${stamp}.json`);
  const latestPath = path.join(reportsDir, "comparison-latest.json");

  const json = JSON.stringify(output, null, 2);
  await writeFile(reportPath, json, "utf8");
  await writeFile(latestPath, json, "utf8");

  console.log(`[compare] done report=${reportPath}`);
  console.log(
    `[compare] summary provinces=${summary.totalProvinces} districts=${summary.totalDistricts} mismatchedDistricts=${summary.districtsWithDiff}`
  );
}

async function compareProvince(province, apiBase) {
  console.log(`[compare] province ${province.slug} started`);

  const sourceProvinceUrl = `${SOURCE_BASE_URL}/nobetci-${province.slug}`;
  const sourceProvinceHtml = await fetchText(sourceProvinceUrl);
  const districtLinks = parseProvinceDistrictLinks(sourceProvinceHtml, province.slug);

  const projectProvincePayload = await fetchProjectProvince(apiBase, province.slug);
  const projectDistrictMap = groupProjectByDistrict(projectProvincePayload.data ?? []);

  const districts = districtLinks.length
    ? districtLinks
    : [
        {
          districtSlug: "merkez",
          districtName: "Merkez",
          url: sourceProvinceUrl
        }
      ];

  const districtResults = await mapLimit(districts, DISTRICT_CONCURRENCY, async (district) => {
    const sourceHtml = district.url === sourceProvinceUrl ? sourceProvinceHtml : await fetchText(district.url);
    const sourceData = parseSourceDistrictPage(sourceHtml, SOURCE_TAB);

    const match = resolveProjectDistrictMatch(district.districtSlug, projectDistrictMap);
    const projectItems = match ? projectDistrictMap.get(match)?.items ?? [] : [];

    return compareDistrict({
      provinceName: province.name,
      district,
      sourceData,
      projectItems,
      matchedProjectDistrictSlug: match,
      projectAvailableDates: projectProvincePayload.available_dates ?? []
    });
  });

  console.log(`[compare] province ${province.slug} done districts=${districtResults.length}`);

  return {
    şehir: province.name,
    şehirSlug: province.slug,
    ilçeler: districtResults
  };
}

function compareDistrict({
  provinceName,
  district,
  sourceData,
  projectItems,
  matchedProjectDistrictSlug,
  projectAvailableDates
}) {
  const sourcePharmacies = dedupeByName(
    sourceData.pharmacies.map((item) => ({
      isim: item.name,
      adres: item.address,
      nöbetSaatleri: item.dutyHours
    }))
  );

  const projectPharmacies = dedupeByName(
    projectItems.map((item) => ({
      isim: item.eczane_adi,
      adres: item.adres,
      nöbetSaatleri:
        typeof item.nöbetSaatleri === "string"
          ? item.nöbetSaatleri
          : typeof item.nobetSaatleri === "string"
            ? item.nobetSaatleri
            : typeof item.nobet_saatleri === "string"
              ? item.nobet_saatleri
              : null
    }))
  );

  const sourceMap = new Map(sourcePharmacies.map((item) => [normalizeName(item.isim), item]));
  const projectMap = new Map(projectPharmacies.map((item) => [normalizeName(item.isim), item]));

  const matchedKeys = [...sourceMap.keys()].filter((key) => projectMap.has(key));
  const sourceOnlyKeys = [...sourceMap.keys()].filter((key) => !projectMap.has(key));
  const projectOnlyKeys = [...projectMap.keys()].filter((key) => !sourceMap.has(key));

  const addressMismatches = [];
  const timeMismatches = [];

  for (const key of matchedKeys) {
    const sourceItem = sourceMap.get(key);
    const projectItem = projectMap.get(key);
    if (!sourceItem || !projectItem) {
      continue;
    }

    if (normalizeAddress(sourceItem.adres) !== normalizeAddress(projectItem.adres)) {
      addressMismatches.push({
        isim: sourceItem.isim,
        kaynakAdres: sourceItem.adres,
        projeAdres: projectItem.adres
      });
    }

    const sourceTime = normalizeText(sourceItem.nöbetSaatleri ?? "");
    const projectTime = normalizeText(projectItem.nöbetSaatleri ?? "");
    if ((sourceTime || projectTime) && sourceTime !== projectTime) {
      timeMismatches.push({
        isim: sourceItem.isim,
        kaynakSaat: sourceItem.nöbetSaatleri,
        projeSaat: projectItem.nöbetSaatleri
      });
    }
  }

  const districtName = district.districtName || titleCaseFromSlug(district.districtSlug);

  return {
    il: provinceName,
    ilçe: districtName,
    kaynakUrl: district.url,
    eşleşenProjeİlçeSlug: matchedProjectDistrictSlug,
    projeMevcutTarihleri: projectAvailableDates,
    kaynakEczaneler: sourcePharmacies,
    projeEczaneler: projectPharmacies,
    karşılaştırma: {
      eklenen: projectOnlyKeys.map((key) => projectMap.get(key)?.isim).filter(Boolean),
      çıkarılan: sourceOnlyKeys.map((key) => sourceMap.get(key)?.isim).filter(Boolean),
      eşleşen: matchedKeys.map((key) => sourceMap.get(key)?.isim).filter(Boolean),
      saatUyumsuzluğuVar: timeMismatches.length > 0,
      saatUyumsuzluğu: timeMismatches,
      adresUyumsuzluğuVar: addressMismatches.length > 0,
      adresUyumsuzluğu: addressMismatches
    }
  };
}

async function resolveProjectApiBase() {
  const candidates = [];

  if (PROJECT_API_BASE_URL_HINT) {
    candidates.push(PROJECT_API_BASE_URL_HINT);
  }
  candidates.push(normalizeApiBase(`${PROJECT_WEB_BASE_URL}/api`));

  if (/nobetci-eczane-tau\.vercel\.app/i.test(PROJECT_WEB_BASE_URL)) {
    candidates.push("https://nobetci-eczane-api-ten.vercel.app/api");
  }

  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
  const errors = [];

  for (const candidate of uniqueCandidates) {
    try {
      const provinces = await fetchJson(`${candidate}/iller`);
      if (Array.isArray(provinces) && provinces.length) {
        return {
          apiBase: candidate,
          provinces: provinces.map((row) => ({
            code: String(row.code ?? ""),
            name: String(row.name ?? "").trim() || titleCaseFromSlug(String(row.slug ?? "")),
            slug: toSlugTr(String(row.slug ?? "").trim())
          }))
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate} => ${message}`);
    }
  }

  const fallbackProvinces = await tryLoadProvinceLinksCsv();
  if (fallbackProvinces.length) {
    if (!PROJECT_API_BASE_URL_HINT) {
      throw new Error(
        `Project API base could not be resolved automatically. Set PROJECT_API_BASE_URL. Attempts: ${errors.join(" | ")}`
      );
    }

    return {
      apiBase: PROJECT_API_BASE_URL_HINT,
      provinces: fallbackProvinces
    };
  }

  throw new Error(`Project API base not resolved. Attempts: ${errors.join(" | ")}`);
}

async function fetchProjectProvince(apiBase, provinceSlug) {
  const payload = await fetchJson(`${apiBase}/il/${encodeURIComponent(provinceSlug)}/nobetci`);
  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    available_dates: Array.isArray(payload?.available_dates) ? payload.available_dates : []
  };
}

function groupProjectByDistrict(items) {
  const grouped = new Map();

  for (const item of items) {
    const districtName = String(item?.ilce ?? "").trim();
    const districtSlug = toSlugTr(districtName);
    if (!districtSlug) {
      continue;
    }

    const entry = grouped.get(districtSlug) ?? {
      districtName,
      items: []
    };
    entry.items.push(item);
    grouped.set(districtSlug, entry);
  }

  return grouped;
}

function resolveProjectDistrictMatch(sourceDistrictSlug, projectMap) {
  if (!sourceDistrictSlug) {
    return null;
  }

  if (projectMap.has(sourceDistrictSlug)) {
    return sourceDistrictSlug;
  }

  const aliases = {
    kazan: "kahramankazan",
    kahramankazan: "kazan",
    gumushane: "gumushane-merkez"
  };
  const alias = aliases[sourceDistrictSlug];
  if (alias && projectMap.has(alias)) {
    return alias;
  }

  const keys = [...projectMap.keys()];
  const contains = keys.filter((key) => key.includes(sourceDistrictSlug) || sourceDistrictSlug.includes(key));
  if (contains.length === 1) {
    return contains[0];
  }

  return null;
}

function parseProvinceDistrictLinks(html, provinceSlug) {
  const $ = load(html);
  const links = new Map();
  const pattern = new RegExp(`^/nobetci-${escapeRegex(provinceSlug)}-([a-z0-9-]+)$`, "i");

  $("a[href]").each((_, el) => {
    const hrefRaw = String($(el).attr("href") ?? "").trim();
    if (!hrefRaw) {
      return;
    }

    const href = hrefRaw.split("?")[0].replace(/\/$/, "");
    const match = href.match(pattern);
    if (!match) {
      return;
    }

    const districtSlug = toSlugTr(match[1] ?? "");
    if (!districtSlug) {
      return;
    }

    const districtName = cleanText($(el).text()) || titleCaseFromSlug(districtSlug);
    links.set(districtSlug, {
      districtSlug,
      districtName,
      url: `${SOURCE_BASE_URL}${href}`
    });
  });

  return [...links.values()].sort((a, b) => a.districtSlug.localeCompare(b.districtSlug, "tr"));
}

function parseSourceDistrictPage(html, tab = "bugun") {
  const $ = load(html);
  const paneId = `#nav-${tab}`;
  let pane = $(paneId);
  if (!pane.length) {
    pane = $(".tab-pane.show.active").first();
  }
  if (!pane.length) {
    pane = $("main, body").first();
  }

  const dutyHours =
    cleanText(pane.find(".alert").first().text()) ||
    cleanText($(".alert.alert-warning").first().text()) ||
    null;

  const rows = [];
  pane.find("tr").each((_, rowEl) => {
    const row = $(rowEl);
    const name =
      cleanText(row.find("span.isim").first().text()) ||
      cleanText(row.find(".isim").first().text()) ||
      cleanText(row.find("a").first().text());

    if (!name || /eczane\s*adi/i.test(name)) {
      return;
    }

    const phone = extractPhone(cleanText(row.text()));
    const addressCol = row.find(".col-lg-6, .col-md-6, .col-6").first().clone();
    addressCol.find(".py-2, .my-2, .rounded, span, .font-italic").remove();
    let address = cleanText(addressCol.text());

    if (!address) {
      address = cleanText(row.text())
        .replace(name, "")
        .replace(phone ?? "", "")
        .trim();
    }

    rows.push({
      name: ensureEczaneSuffix(name),
      address,
      phone,
      dutyHours
    });
  });

  return {
    dutyHours,
    pharmacies: dedupeSourceRows(rows)
  };
}

function dedupeSourceRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = normalizeName(row.name);
    if (!key) {
      continue;
    }
    if (!map.has(key)) {
      map.set(key, row);
    }
  }
  return [...map.values()];
}

function dedupeByName(items) {
  const map = new Map();
  for (const item of items) {
    const key = normalizeName(item.isim);
    if (!key) {
      continue;
    }
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

function buildSummary(provinces) {
  let totalDistricts = 0;
  let districtsWithDiff = 0;
  let totalSource = 0;
  let totalProject = 0;

  for (const province of provinces) {
    for (const district of province.ilçeler ?? []) {
      totalDistricts += 1;
      totalSource += district.kaynakEczaneler?.length ?? 0;
      totalProject += district.projeEczaneler?.length ?? 0;

      const cmp = district.karşılaştırma;
      const hasDiff =
        (cmp?.eklenen?.length ?? 0) > 0 ||
        (cmp?.çıkarılan?.length ?? 0) > 0 ||
        (cmp?.saatUyumsuzluğu?.length ?? 0) > 0 ||
        (cmp?.adresUyumsuzluğu?.length ?? 0) > 0;
      if (hasDiff) {
        districtsWithDiff += 1;
      }
    }
  }

  return {
    totalProvinces: provinces.length,
    totalDistricts,
    totalSourcePharmacies: totalSource,
    totalProjectPharmacies: totalProject,
    districtsWithDiff
  };
}

async function tryLoadProvinceLinksCsv() {
  try {
    const csvPath = path.join(REPO_ROOT, "infra", "sources", "province-links.csv");
    const content = await readFile(csvPath, "utf8");
    const lines = content
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean);

    const out = [];
    for (const line of lines) {
      const slug = toSlugTr(line.split(",")[0] ?? "");
      if (!slug) {
        continue;
      }
      out.push({
        code: "",
        name: titleCaseFromSlug(slug),
        slug
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchJson(url) {
  const text = await fetchText(url, {
    accept: "application/json,text/plain;q=0.9,*/*;q=0.8"
  });

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${url}`);
  }
}

async function fetchText(url, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "accept-language": "tr-TR,tr;q=0.9,en;q=0.8",
        pragma: "no-cache",
        "cache-control": "no-cache, no-store, max-age=0",
        ...extraHeaders
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${url} => ${error.message}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function mapLimit(items, limit, mapper) {
  const safeLimit = Math.max(1, Math.min(limit, items.length || 1));
  const results = new Array(items.length);
  let index = 0;

  const workers = Array.from({ length: safeLimit }, async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) {
        break;
      }
      results[current] = await mapper(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
}

function normalizeApiBase(value) {
  const cleaned = trimSlash(value.trim());
  if (cleaned.endsWith("/api")) {
    return cleaned;
  }
  return `${cleaned}/api`;
}

function trimSlash(value) {
  return value.replace(/\/+$/, "");
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return toSlugTr(cleanText(value));
}

function normalizeName(value) {
  // Normalize first, then strip known suffixes to handle Turkish casing reliably.
  const slug = toSlugTr(cleanText(value));
  return slug
    .replace(/-?eczanesi$/g, "")
    .replace(/-?eczane$/g, "")
    .replace(/-/g, "");
}

function normalizeAddress(value) {
  return normalizeText(value)
    .replace(/\bmah\b/g, "")
    .replace(/\bmh\b/g, "")
    .replace(/\bno\b/g, "");
}

function toSlugTr(value) {
  return String(value ?? "")
    .trim()
    .replace(/[İIı]/g, "i")
    .replace(/[Şş]/g, "s")
    .replace(/[Ğğ]/g, "g")
    .replace(/[Üü]/g, "u")
    .replace(/[Öö]/g, "o")
    .replace(/[Çç]/g, "c")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCaseFromSlug(slug) {
  return String(slug)
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toLocaleUpperCase("tr-TR")}${part.slice(1)}`)
    .join(" ");
}

function ensureEczaneSuffix(name) {
  const cleaned = cleanText(name);
  if (!cleaned) {
    return "";
  }
  if (/\beczane(si)?\b/i.test(cleaned)) {
    return cleaned;
  }
  return `${cleaned} Eczanesi`;
}

function extractPhone(text) {
  const match = cleanText(text).match(/(\+?90[\s().-]*)?0?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/);
  if (!match) {
    return null;
  }
  return cleanText(match[0]);
}

function toFileStamp(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[compare] failed: ${message}`);
  process.exit(1);
});
