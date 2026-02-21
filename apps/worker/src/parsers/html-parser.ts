import { normalizePharmacyName, resolveActiveDutyWindow, toSlug } from "@nobetci/shared";
import { load, CheerioAPI } from "cheerio";
import { SourceEndpointConfig, SourceRecord } from "../core/types";

interface ParsedRow {
  districtName: string;
  districtSlug: string;
  pharmacyName: string;
  address: string;
  phone: string;
  lat: number | null;
  lng: number | null;
}

type ParserFn = ($: CheerioAPI, endpoint: SourceEndpointConfig) => ParsedRow[];

export function parseHtmlToSourceRecords(html: string, endpoint: SourceEndpointConfig): SourceRecord[] {
  const $ = load(html);
  const rows = selectParser(endpoint.parserKey)($, endpoint);
  const now = new Date().toISOString();
  const { dutyDate } = resolveActiveDutyWindow();

  return rows.map<SourceRecord>((row) => ({
    provinceSlug: endpoint.provinceSlug,
    districtName: row.districtName,
    districtSlug: row.districtSlug,
    pharmacyName: row.pharmacyName,
    normalizedName: normalizePharmacyName(row.pharmacyName),
    address: row.address,
    phone: normalizePhone(row.phone),
    lat: row.lat,
    lng: row.lng,
    dutyDate,
    fetchedAt: now
  }));
}

function selectParser(parserKey: string): ParserFn {
  const map: Record<string, ParserFn> = {
    adana_primary_v1: parseAdanaPrimaryRows,
    adana_secondary_v1: parseAdanaSecondaryRows,
    istanbul_primary_v1: parseIstanbulPrimaryRows,
    istanbul_secondary_v1: parseIstanbulSecondaryRows,
    osmaniye_eo_v1: parseOsmaniyeEczaciOdasiRows,
    generic_auto_v1: parseGenericAutoRows,
    generic_table: parseTableRows,
    generic_list: parseListRows
  };

  if (map[parserKey]) {
    return map[parserKey];
  }

  return parserKey.includes("list") ? parseListRows : parseTableRows;
}

function parseAdanaPrimaryRows($: CheerioAPI): ParsedRow[] {
  const officialRows = parseAdanaAsmTableRows($);
  if (officialRows.length) {
    return officialRows;
  }

  const combined = dedupeRows([...parseTableRows($), ...parseListRows($)]);
  return refineRowsByDistrictDictionary(combined, ADANA_DISTRICTS, "Seyhan");
}

function parseAdanaSecondaryRows($: CheerioAPI): ParsedRow[] {
  const officialRows = parseAdanaEczaciOdasiRows($);
  if (officialRows.length) {
    return officialRows;
  }

  const combined = dedupeRows([...parseListRows($), ...parseTableRows($)]);
  return refineRowsByDistrictDictionary(combined, ADANA_DISTRICTS, "Seyhan");
}

function parseIstanbulPrimaryRows($: CheerioAPI): ParsedRow[] {
  const rows = parseTableRows($);
  return refineRowsByDistrictDictionary(rows, ISTANBUL_DISTRICTS, "Fatih");
}

function parseIstanbulSecondaryRows($: CheerioAPI): ParsedRow[] {
  const combined = dedupeRows([...parseListRows($), ...parseTableRows($)]);
  return refineRowsByDistrictDictionary(combined, ISTANBUL_DISTRICTS, "Fatih");
}

function parseOsmaniyeEczaciOdasiRows($: CheerioAPI): ParsedRow[] {
  const fromNobetkarti = parseOsmaniyeNobetkartiRows($);
  if (fromNobetkarti.length) {
    return fromNobetkarti;
  }

  const rows: ParsedRow[] = [];
  $("div.nobet-kart").each((_, cardEl) => {
    const card = $(cardEl);
    const heading = cleanText(card.find("h4").first().text());
    if (!heading) {
      return;
    }

    const [nameRaw, districtRaw] = heading.split(" - ").map((part) => cleanText(part));
    const pharmacyName = ensureEczaneSuffix(nameRaw);
    if (!pharmacyName) {
      return;
    }

    const phoneAnchor = card.find("a[href^='tel:']").first();
    const phone = findPhone(cleanText(phoneAnchor.text()) || cleanText(card.text()));
    if (!phone) {
      return;
    }

    const paragraph = card.find("p").first().clone();
    paragraph.find("a[href], i").remove();
    const address = cleanText(paragraph.text())
      .replace(/Eczaneyi haritada goruntulemek icin tiklayiniz\.\.\./gi, "")
      .trim();

    const mapHref = card.find("a[href*='google.com/maps']").first().attr("href");
    const coords = extractCoordinates(mapHref);

    const districtName = districtRaw || "Merkez";
    rows.push({
      districtName,
      districtSlug: toSlug(districtName),
      pharmacyName,
      address,
      phone,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null
    });
  });

  return dedupeRows(rows);
}

function parseOsmaniyeNobetkartiRows($: CheerioAPI): ParsedRow[] {
  const rows: ParsedRow[] = [];

  $("div.cerceve div.eczane").each((_, cardEl) => {
    const card = $(cardEl);
    const pharmacyName = ensureEczaneSuffix(cleanText(card.children(".adi").first().text()));
    if (!pharmacyName) {
      return;
    }

    const addressNode = card.children(".adres").first().clone();
    const address = cleanText(addressNode.text());
    if (!address) {
      return;
    }

    const contactNode = card.children(".adres").last();
    const phone = findPhone(cleanText(contactNode.find(".adres2").first().text()) || cleanText(contactNode.text()));
    if (!phone) {
      return;
    }

    const districtRaw = cleanText(contactNode.find(".tel").first().text());
    const districtName = normalizeOsmaniyeDistrict(districtRaw);

    rows.push({
      districtName,
      districtSlug: toSlug(districtName),
      pharmacyName,
      address,
      phone,
      lat: null,
      lng: null
    });
  });

  return dedupeRows(rows);
}

function parseGenericAutoRows($: CheerioAPI): ParsedRow[] {
  return dedupeRows([...parseTableRows($), ...parseListRows($)]);
}

function parseAdanaEczaciOdasiRows($: CheerioAPI): ParsedRow[] {
  const rows: ParsedRow[] = [];

  $("div.col-md-12.nobetci").each((_, cardEl) => {
    const card = $(cardEl);

    const pharmacyName = ensureEczaneSuffix(
      cleanText(card.find("h4 strong").first().text()) || cleanText(card.find("h4").first().text())
    );
    if (!pharmacyName) {
      return;
    }

    const phone = findPhone(
      cleanText(card.find("a[href^='tel:']").first().text()) ||
        cleanText(card.find("p").first().text()) ||
        cleanText(card.text())
    );
    if (!phone) {
      return;
    }

    const body = card.find("p").first().clone();
    body.find("a, i").remove();
    const address = cleanText(body.text());
    if (!address) {
      return;
    }

    const mapHref = card.find("a[href*='google.com/maps']").first().attr("href");
    const coords = extractCoordinates(mapHref);
    const districtName = detectAdanaDistrict($, cardEl) ?? "Seyhan";

    rows.push({
      districtName,
      districtSlug: toSlug(districtName),
      pharmacyName,
      address,
      phone,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null
    });
  });

  return refineRowsByDistrictDictionary(dedupeRows(rows), ADANA_DISTRICTS, "Seyhan");
}

function parseAdanaAsmTableRows($: CheerioAPI): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const table = $("table.dynamicTable").first();
  if (!table.length) {
    return rows;
  }

  table.find("tr.gradeA").each((_, rowEl) => {
    const cells = $(rowEl).find("td");
    if (cells.length < 5) {
      return;
    }

    const districtName = cleanText(cells.eq(1).text()) || "Seyhan";
    const pharmacyName = ensureEczaneSuffix(cleanText(cells.eq(2).text()));
    const phone = findPhone(cleanText(cells.eq(3).text()));
    const address = cleanText(cells.eq(4).text());

    if (!pharmacyName || !phone || !address) {
      return;
    }

    rows.push({
      districtName,
      districtSlug: toSlug(districtName),
      pharmacyName,
      address,
      phone,
      lat: null,
      lng: null
    });
  });

  return dedupeRows(rows);
}

function parseTableRows($: CheerioAPI): ParsedRow[] {
  const parsed: ParsedRow[] = [];
  $("table").each((_, table) => {
    const districtName = detectDistrictName($, table) ?? "Merkez";
    $(table)
      .find("tr")
      .each((__, tr) => {
        const cells = $(tr)
          .find("th,td")
          .map((___, cell) => cleanText($(cell).text()))
          .get()
          .filter(Boolean);

        if (!cells.length || isHeaderRow(cells)) {
          return;
        }

        const phone = findPhone(cells.join(" "));
        const pharmacyName = findPharmacyName(cells);
        if (!phone || !pharmacyName || !isValidPharmacyName(pharmacyName)) {
          return;
        }

        const address = findAddress(cells, pharmacyName, phone) ?? "";
        const href = $(tr).find("a[href]").first().attr("href");
        const coords = extractCoordinates(href);

        parsed.push({
          districtName,
          districtSlug: toSlug(districtName),
          pharmacyName,
          address,
          phone,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null
        });
      });
  });

  return dedupeRows(parsed);
}

function parseListRows($: CheerioAPI): ParsedRow[] {
  const parsed: ParsedRow[] = [];
  const selector = "li, article, .eczane, .pharmacy, .nobetci-eczane";
  $(selector).each((_, item) => {
    const text = cleanText($(item).text());
    if (!text) {
      return;
    }

    const phone = findPhone(text);
    const pharmacyName = findPharmacyName(text.split(" ").filter(Boolean));
    if (!phone || !pharmacyName || !isValidPharmacyName(pharmacyName)) {
      return;
    }

    const districtName = detectDistrictFromAncestors($, item) ?? "Merkez";
    const address = text.replace(pharmacyName, "").replace(phone, "").trim();
    const href = $(item).find("a[href]").first().attr("href");
    const coords = extractCoordinates(href);

    parsed.push({
      districtName,
      districtSlug: toSlug(districtName),
      pharmacyName,
      address,
      phone,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null
    });
  });

  return dedupeRows(parsed);
}

function detectDistrictName($: CheerioAPI, table: any): string | null {
  const heading = $(table).prevAll("h1,h2,h3,h4,strong").first().text();
  const cleaned = cleanText(heading);
  if (!cleaned) {
    return null;
  }
  return cleaned.replace(/nobetci eczane(ler)?/gi, "").trim() || null;
}

function detectDistrictFromAncestors($: CheerioAPI, node: any): string | null {
  const heading = $(node).closest("section,div").prevAll("h1,h2,h3,h4,strong").first().text();
  const cleaned = cleanText(heading);
  if (!cleaned) {
    return null;
  }
  return cleaned.replace(/nobetci eczane(ler)?/gi, "").trim() || null;
}

function detectAdanaDistrict($: CheerioAPI, node: any): string | null {
  const heading = $(node).prevAll("h1,h2,h3,h4,strong,.main-color").first().text();
  const cleaned = cleanText(heading);
  if (!cleaned) {
    return null;
  }
  return cleaned.replace(/nobetci eczane(ler)?/gi, "").trim() || null;
}

function findPharmacyName(parts: string[]): string | null {
  const fromEczane = parts.find((part) => /eczane/i.test(part));
  if (fromEczane) {
    return fromEczane;
  }

  const joined = parts.join(" ");
  const match = joined.match(/([A-ZÇĞİÖŞÜ][\w\s'-]{2,50}\sEczanesi?)/i);
  if (match) {
    return cleanText(match[1]);
  }

  return parts[0] ? cleanText(parts[0]) : null;
}

function findAddress(cells: string[], pharmacyName: string, phone: string): string | null {
  const candidates = cells
    .map(cleanText)
    .filter(Boolean)
    .filter((cell) => !cell.includes(pharmacyName))
    .filter((cell) => !cell.includes(phone))
    .sort((a, b) => b.length - a.length);
  return candidates[0] ?? null;
}

function ensureEczaneSuffix(value: string): string {
  const normalized = cleanText(value);
  if (!normalized) {
    return "";
  }

  if (/eczane(si)?/i.test(normalized)) {
    return normalized;
  }

  return `${normalized} Eczanesi`;
}

function isValidPharmacyName(value: string): boolean {
  const normalized = cleanText(value);
  if (!normalized) {
    return false;
  }

  const hasLetter = /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(normalized);
  if (!hasLetter) {
    return false;
  }

  return normalized.length >= 3;
}

function findPhone(value: string): string | null {
  const match = value.match(/(\+?90[\s().-]*)?0?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/);
  if (!match) {
    return null;
  }

  const digits = match[0].replace(/\D/g, "");
  if (digits.length === 10) {
    return `0${digits}`;
  }
  if (digits.length === 11) {
    return digits;
  }
  if (digits.length >= 12 && digits.startsWith("90")) {
    return `+${digits.slice(0, 12)}`;
  }

  return null;
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function extractCoordinates(href?: string): { lat: number; lng: number } | null {
  if (!href) {
    return null;
  }

  const queryMatch = href.match(/q=([0-9.\-]+),([0-9.\-]+)/i);
  if (queryMatch) {
    return {
      lat: Number(queryMatch[1]),
      lng: Number(queryMatch[2])
    };
  }

  const atMatch = href.match(/@([0-9.\-]+),([0-9.\-]+)/);
  if (atMatch) {
    return {
      lat: Number(atMatch[1]),
      lng: Number(atMatch[2])
    };
  }

  return null;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
}

function isHeaderRow(cells: string[]): boolean {
  const line = cells.join(" ").toLocaleLowerCase("tr-TR");
  return line.includes("eczane adi") || line.includes("telefon") || line.includes("adres");
}

function dedupeRows(items: ParsedRow[]): ParsedRow[] {
  const map = new Map<string, ParsedRow>();
  for (const item of items) {
    const key = `${item.districtSlug}:${normalizePharmacyName(item.pharmacyName)}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

function normalizeOsmaniyeDistrict(value: string): string {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return "Merkez";
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return "Merkez";
  }

  if (tokens.length >= 2 && toSlug(tokens[0]) === "osmaniye") {
    return tokens.slice(1).join(" ");
  }

  return cleaned;
}

function refineRowsByDistrictDictionary(
  rows: ParsedRow[],
  districts: readonly string[],
  fallbackDistrict: string
): ParsedRow[] {
  return rows.map((row) => {
    const text = `${row.districtName} ${row.address} ${row.pharmacyName}`.toLocaleLowerCase("tr-TR");
    const matched = districts.find((item) => text.includes(item.toLocaleLowerCase("tr-TR")));
    const district = matched ?? fallbackDistrict;

    return {
      ...row,
      districtName: district,
      districtSlug: toSlug(district)
    };
  });
}

const ADANA_DISTRICTS = [
  "Seyhan",
  "Cukurova",
  "Yuregir",
  "Sariçam",
  "Pozanti",
  "Kozan",
  "Ceyhan",
  "Imamoglu",
  "Aladag"
] as const;

const ISTANBUL_DISTRICTS = [
  "Fatih",
  "Kadikoy",
  "Besiktas",
  "Sisli",
  "Uskudar",
  "Bakirkoy",
  "Beyoglu",
  "Atasehir",
  "Pendik",
  "Kartal",
  "Eyupsultan",
  "Sariyer"
] as const;
