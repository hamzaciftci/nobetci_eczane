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
    tokat_schedule_v1: parseTokatScheduleRows,
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

  $("div.cerceve div.eczane, div.cerceve div.eczane2").each((_, cardEl) => {
    const card = $(cardEl);
    const rawCardText = cleanText(card.text());
    const pharmacyName = ensureEczaneSuffix(
      cleanText(card.children(".adi").first().text()) ||
        cleanText(card.find(".eadi").first().text()) ||
        cleanText(card.find("strong, b").first().text())
    );
    if (!pharmacyName) {
      return;
    }

    const addressNode =
      card.children(".adres").first().clone().length > 0
        ? card.children(".adres").first().clone()
        : card.find(".eczane2 .adres").first().clone();
    let address = cleanText(addressNode.text());
    address = address
      .replace(/tel\s*[:.]?/gi, "")
      .replace(/\b0\d{3}[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}\b/g, "")
      .replace(/\s+-\s+/g, " ")
      .trim();
    if (address.includes(pharmacyName)) {
      address = address.replace(pharmacyName, "").trim();
    }
    if (!address) {
      address = rawCardText.replace(pharmacyName, "").trim();
    }

    const contactNode = card.children(".adres").last();
    const phone = findPhone(
      cleanText(contactNode.find(".adres2").first().text()) || cleanText(contactNode.text()) || rawCardText
    );
    if (!phone) {
      return;
    }

    const districtRaw = cleanText(contactNode.find(".tel").first().text());
    const districtName =
      normalizeOsmaniyeDistrict(districtRaw) ||
      extractDistrictFromAddress(address) ||
      extractDistrictFromAddress(rawCardText) ||
      "Merkez";

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
  return dedupeRows([
    ...parseTableRows($),
    ...parseNobetciCardRows($),
    ...parseAmasyaNobetcitekRows($),
    ...parseStructuredRowCardRows($),
    ...parseInlineBoxRows($),
    ...parseListRows($),
    ...parseOsmaniyeNobetkartiRows($),
    ...parseTextBlockRows($),
    ...parseSchemaPharmacyRows($),
    ...parseMapBalloonRows($)
  ]);
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
  const { dutyDate: activeDutyDate } = resolveActiveDutyWindow();

  $("table").each((_, table) => {
    const tableDistrict = detectDistrictName($, table) ?? "Merkez";
    let currentDistrict = tableDistrict;

    $(table)
      .find("tr")
      .each((__, tr) => {
        const cells = $(tr)
          .find("th,td")
          .map((___, cell) => cleanText($(cell).text()))
          .get()
          .filter(Boolean);

        if (!cells.length) {
          return;
        }

        const districtHeading = extractDistrictFromHeading(cells.join(" "));
        if (districtHeading) {
          currentDistrict = districtHeading;
          return;
        }

        if (isHeaderRow(cells)) {
          return;
        }

        const rowDate = extractDateFromText(cells[0] ?? "");
        if (rowDate && rowDate !== activeDutyDate) {
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
        const districtName =
          extractDistrictFromRowText(cells.join(" ")) ||
          extractDistrictFromAddress(address) ||
          currentDistrict ||
          tableDistrict;

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
  const selector =
    "li, article, .eczane, .eczane2, .pharmacy, .nobetci-eczane, .inline-box, .nobetciDiv, .nobet-item, .nobet-card, .kartItem";
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

function parseNobetciCardRows($: CheerioAPI): ParsedRow[] {
  const rows: ParsedRow[] = [];

  $("div.col-md-12.nobetci, div.nobetci").each((_, cardEl) => {
    const card = $(cardEl);
    const headingRaw = cleanText(card.find("h4").first().text());
    const headingParts = headingRaw.split(" - ").map((part) => cleanText(part));
    const pharmacyName = ensureEczaneSuffix(headingParts[0] ?? "");
    if (!pharmacyName) {
      return;
    }

    const phone = findPhone(
      cleanText(card.find("a[href^='tel:']").first().text()) ||
        cleanText(card.find("a[href^='tel:']").first().attr("href")?.replace(/^tel:/i, "") ?? "") ||
        cleanText(card.text())
    );
    if (!phone) {
      return;
    }

    const paragraph = card.find("p").first().clone();
    paragraph.find("a, i, strong, b").remove();
    const address = cleanText(
      paragraph
        .text()
        .replace(/Haritada g[oö]r[üu]nt[üu]lemek i[cç]in t[ıi]klay[ıi]n[ıi]z\.{0,3}/gi, "")
        .replace(/Tel(e)?fon\s*[:.]?/gi, "")
    );
    if (!address) {
      return;
    }

    const mapHref = card.find("a[href*='maps.google.com'], a[href*='google.com/maps']").first().attr("href");
    const coords = extractCoordinates(mapHref);
    const districtName =
      headingParts[1] ||
      detectDistrictFromAncestors($, cardEl) ||
      extractDistrictFromAddress(address) ||
      "Merkez";

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

function parseAmasyaNobetcitekRows($: CheerioAPI): ParsedRow[] {
  const rows: ParsedRow[] = [];

  $(".nobetcitek").each((_, itemEl) => {
    const item = $(itemEl);
    const parent = item.parent();
    const districtHeading = cleanText(parent.children("h4").first().text());
    const districtName =
      extractDistrictFromHeading(districtHeading) ||
      districtHeading.replace(/N[öo]bet[cç]i Eczaneler/gi, "").trim() ||
      "Merkez";

    const nameLine = cleanText(item.find(".eczanebilgileri .eczaneismi").first().text());
    const phone = findPhone(nameLine) || findPhone(cleanText(item.text()));
    const pharmacyName = ensureEczaneSuffix(cleanText(nameLine.replace(phone ?? "", "").replace(/-\s*$/, "")));
    const address = cleanText(item.find(".eczanebilgileri .eczaneadres").first().text());
    const mapHref = item.find("a.ikonum[href]").first().attr("href");
    const coords = extractCoordinates(mapHref);

    if (!pharmacyName || !phone || !address) {
      return;
    }

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

function parseStructuredRowCardRows($: CheerioAPI): ParsedRow[] {
  const rows: ParsedRow[] = [];

  $("div.row").each((_, rowEl) => {
    const row = $(rowEl);
    if (!row.find("i.icon-phone, i.fa-phone").length) {
      return;
    }

    const headingRaw = cleanText(row.find("h4").first().text()).replace(/^[-•\s]+/, "");
    const pharmacyName = ensureEczaneSuffix(headingRaw);
    const rawText = cleanText(row.text());
    const phone = findPhone(rawText);
    if (!pharmacyName || !phone) {
      return;
    }

    const paragraph = row.find("p").first().clone();
    paragraph.find("a, i, strong, b").remove();
    const address = cleanText(
      paragraph
        .text()
        .replace(phone, "")
        .replace(/HARI[̇I]TA/gi, "")
        .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, "")
        .replace(/\b\d{1,2}:\d{2}\b/g, "")
    );
    if (!address) {
      return;
    }

    const sectionHeading = cleanText(row.prevAll("h2,h3,h4").first().text());
    const districtName =
      extractDistrictFromHeading(sectionHeading) ||
      extractDistrictFromAddress(address) ||
      "Merkez";
    const mapHref = row.find("a[href*='maps.google.com'], a[href*='google.com/maps']").first().attr("href");
    const coords = extractCoordinates(mapHref);

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

function parseInlineBoxRows($: CheerioAPI): ParsedRow[] {
  const rows: ParsedRow[] = [];

  $(".inline-box").each((_, boxEl) => {
    const box = $(boxEl);
    const nameRaw = cleanText(String(box.attr("data-name") ?? ""));
    const districtRaw = cleanText(String(box.attr("data-district") ?? ""));
    const phoneRaw = cleanText(box.find("a[href^='tel:']").first().attr("href")?.replace(/^tel:/i, "") ?? "");
    const fullText = cleanText(box.text());

    const pharmacyName = ensureEczaneSuffix(nameRaw || findPharmacyName(fullText.split(" ").filter(Boolean)) || "");
    const phone = findPhone(phoneRaw) ?? findPhone(fullText) ?? normalizeLoosePhone(phoneRaw);
    const districtName = districtRaw || extractDistrictFromAddress(fullText) || "Merkez";
    let address = fullText;
    if (pharmacyName) {
      address = address.replace(pharmacyName, "").trim();
    }
    if (phone) {
      address = address.replace(phone, "").trim();
    }
    address = address.replace(/(Yol Tarifi Al[ıi]n|Hemen Aray[ıi]n)/gi, "").trim();

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

function parseTextBlockRows($: CheerioAPI): ParsedRow[] {
  const bodyText = cleanText($("body").text());
  if (!bodyText || !/eczane/i.test(bodyText)) {
    return [];
  }

  const rows: ParsedRow[] = [];
  const regex = /(?:G[ÜU]ND[ÜU]Z[-\s]*GECE\s*:\s*)?([A-ZÇĞİÖŞÜ0-9\s'.-]{2,80}?\sECZANES[İI])\s+(.+?)\s*-\s*(\+?90[\s().-]*)?0?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/gim;

  for (const match of bodyText.matchAll(regex)) {
    const pharmacyName = ensureEczaneSuffix(cleanText(match[1] ?? ""));
    const address = cleanText(match[2] ?? "");
    const phone = findPhone(match[0] ?? "");

    if (!pharmacyName || !phone || !address) {
      continue;
    }

    const districtName = extractDistrictFromAddress(address) ?? "Merkez";
    rows.push({
      districtName,
      districtSlug: toSlug(districtName),
      pharmacyName,
      address,
      phone,
      lat: null,
      lng: null
    });
  }

  return dedupeRows(rows);
}

function parseSchemaPharmacyRows($: CheerioAPI): ParsedRow[] {
  const rows: ParsedRow[] = [];

  $("script").each((_, scriptEl) => {
    const raw = cleanText($(scriptEl).html() ?? "");
    if (!raw) {
      return;
    }
    if (!/@type/i.test(raw) || !/pharmacy/i.test(raw)) {
      return;
    }

    try {
      const payload = JSON.parse(raw) as unknown;
      for (const item of flattenJsonNodes(payload)) {
        if (!item || typeof item !== "object") {
          continue;
        }

        const type = cleanText(String((item as Record<string, unknown>)["@type"] ?? "")).toLowerCase();
        if (!type.includes("pharmacy")) {
          continue;
        }

        const pharmacyName = ensureEczaneSuffix(cleanText(String((item as Record<string, unknown>).name ?? "")));
        const addressObj = (item as Record<string, unknown>).address;
        const streetAddress = cleanText(
          typeof addressObj === "object" && addressObj
            ? String((addressObj as Record<string, unknown>).streetAddress ?? "")
            : String((item as Record<string, unknown>).address ?? "")
        );
        const districtName = cleanText(
          typeof addressObj === "object" && addressObj
            ? String((addressObj as Record<string, unknown>).addressLocality ?? "")
            : ""
        );
        const rawPhone = cleanText(String((item as Record<string, unknown>).telephone ?? ""));
        const phone = findPhone(rawPhone) ?? normalizeLoosePhone(rawPhone);

        if (!pharmacyName || !phone || phone.length < 7 || !streetAddress) {
          continue;
        }

        rows.push({
          districtName: districtName || "Merkez",
          districtSlug: toSlug(districtName || "Merkez"),
          pharmacyName,
          address: streetAddress,
          phone,
          lat: null,
          lng: null
        });
      }
    } catch {
      // ignore non-JSON schema blocks
    }
  });

  return dedupeRows(rows);
}

function parseMapBalloonRows($: CheerioAPI): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const scriptText = $("script")
    .map((_, scriptEl) => $(scriptEl).html() ?? "")
    .get()
    .join("\n");

  if (!scriptText) {
    return rows;
  }

  const markerRegex =
    /Placemark\(\s*\[\s*([0-9.\-]+)\s*,\s*([0-9.\-]+)\s*\]\s*,\s*\{\s*balloonContent:\s*'([^']+)'/gim;

  for (const match of scriptText.matchAll(markerRegex)) {
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    const balloonHtml = match[3] ?? "";
    const plain = cleanText(balloonHtml.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "));

    const nameFromStrong =
      balloonHtml.match(/<strong>\s*([^<]+)\s*<\/strong>/i)?.[1] ??
      balloonHtml.match(/^([^<]+)<br/i)?.[1] ??
      plain.split(" ").slice(0, 3).join(" ");
    const pharmacyName = ensureEczaneSuffix(cleanText(nameFromStrong));
    const phone = findPhone(plain);
    const parts = plain.split(" ").filter(Boolean);
    const districtName = parts.length >= 2 ? parts[parts.length - 2] : "Merkez";

    if (!pharmacyName || !phone) {
      continue;
    }

    rows.push({
      districtName,
      districtSlug: toSlug(districtName),
      pharmacyName,
      address: plain.replace(pharmacyName, "").replace(phone, "").trim(),
      phone,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null
    });
  }

  return dedupeRows(rows);
}

function parseTokatScheduleRows($: CheerioAPI): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const { dutyDate } = resolveActiveDutyWindow();
  const districtName = cleanText($("#bolgelist option[selected]").first().text()) || "Tokat";

  $("table tr").each((_, tr) => {
    const cells = $(tr)
      .find("th,td")
      .map((__, cell) => cleanText($(cell).text()))
      .get()
      .filter(Boolean);
    if (cells.length < 2 || isHeaderRow(cells)) {
      return;
    }

    const rowDate = extractDateFromText(cells[0] ?? "");
    if (!rowDate || rowDate !== dutyDate) {
      return;
    }

    // First cell is date, last cell is print button; pharmacy cells remain in between.
    for (const cell of cells.slice(1, -1)) {
      if (!/eczane/i.test(cell)) {
        continue;
      }

      const phone = findPhone(cell);
      if (!phone) {
        continue;
      }

      const nameMatch = cell.match(/([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s'.-]{1,80}ECZANES[İI])/i);
      const pharmacyName = ensureEczaneSuffix(cleanText(nameMatch?.[1] ?? ""));
      if (!pharmacyName) {
        continue;
      }

      let address = cleanText(
        cell
          .replace(new RegExp(pharmacyName, "i"), "")
          .replace(phone, "")
          .replace(/Telefon\s*:/gi, "")
      );
      if (!address || address === "...") {
        continue;
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
    }
  });

  return dedupeRows(rows);
}

function extractDistrictFromHeading(value: string): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/([A-Za-zÇĞİÖŞÜçğıöşü\s]+)\s+N[öo]bet[cç]i Eczaneler/i);
  if (!match?.[1]) {
    return null;
  }

  const district = cleanText(match[1]).replace(/^-+/, "").trim();
  if (!district) {
    return null;
  }

  return district;
}

function extractDistrictFromRowText(value: string): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return null;
  }

  const slashMatch = cleaned.match(/\/\s*([A-Za-zÇĞİÖŞÜçğıöşü\s]{2,40})\s*(?:Telefon|Tel|$)/i);
  if (slashMatch?.[1]) {
    return cleanText(slashMatch[1]);
  }

  return extractDistrictFromAddress(cleaned);
}

function extractDateFromText(value: string): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return null;
  }

  const numericMatch = cleaned.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (numericMatch) {
    const day = Number(numericMatch[1]);
    const month = Number(numericMatch[2]);
    const year = Number(numericMatch[3]);
    if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)) {
      return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
        .toString()
        .padStart(2, "0")}`;
    }
  }

  const monthMatch = cleaned.match(/\b(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})\b/i);
  if (!monthMatch) {
    return null;
  }

  const day = Number(monthMatch[1]);
  const year = Number(monthMatch[3]);
  const monthKey = toSlug(monthMatch[2] ?? "");
  const month = TURKISH_MONTH_MAP[monthKey];
  if (!month) {
    return null;
  }

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
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
  const fromEczane = parts.find((part) => /eczane|ecz\b/i.test(part));
  if (fromEczane) {
    const normalizedPart = cleanText(fromEczane);
    const exactMatch = normalizedPart.match(/([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s'.-]{1,80}\sECZANES[İI]?)/i);
    if (exactMatch?.[1]) {
      return cleanText(exactMatch[1]);
    }
    const shortMatch = normalizedPart.match(/([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s'.-]{1,80}\sECZ)\b/i);
    if (shortMatch?.[1]) {
      return ensureEczaneSuffix(cleanText(shortMatch[1].replace(/\s+ECZ$/i, "")));
    }
    return ensureEczaneSuffix(normalizedPart);
  }

  const joined = parts.join(" ");
  const match = joined.match(/([A-ZÇĞİÖŞÜ][\w\s'-]{2,80}\sEczanesi?)/i);
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

function normalizeLoosePhone(value: string): string {
  return cleanText(value).replace(/[^\d+]/g, "");
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
  const line = cleanText(cells.join(" "));
  if (!line) {
    return true;
  }

  // Real rows frequently include phone/address text; if a phone exists this is likely a data row.
  if (findPhone(line)) {
    return false;
  }

  const normalized = line
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g");

  const headerTokens = [
    "eczane adi",
    "telefon",
    "adres",
    "bilgiler",
    "tarih",
    "gunluk nobet karti",
    "nobetci eczaneler"
  ];
  const hasHeaderToken = headerTokens.some((token) => normalized.includes(token));
  if (!hasHeaderToken) {
    return false;
  }

  const averageCellLength = Math.round(normalized.length / Math.max(cells.length, 1));
  return averageCellLength <= 24;
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
    return "";
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

function extractDistrictFromAddress(value: string): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return null;
  }

  const slashMatchWithSuffix = cleaned.match(
    /\/\s*([A-Za-zÇĞİÖŞÜçğıöşü\s]{2,40})\s*(?:Telefon|Tel|$)/i
  );
  if (slashMatchWithSuffix?.[1]) {
    return cleanText(slashMatchWithSuffix[1]);
  }

  const slashMatchTail = cleaned.match(/([A-Za-zÇĞİÖŞÜçğıöşü\s]+)\s*\/\s*[A-Za-zÇĞİÖŞÜçğıöşü\s]+$/);
  if (slashMatchTail?.[1]) {
    return cleanText(slashMatchTail[1]);
  }

  const merMatch = cleaned.match(/\b([A-Za-zÇĞİÖŞÜçğıöşü\s]+)\s+MERKEZ\b/i);
  if (merMatch?.[1]) {
    return cleanText(merMatch[1]);
  }

  return null;
}

function flattenJsonNodes(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => flattenJsonNodes(item));
  }

  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const nodes: unknown[] = [obj];

    if (Array.isArray(obj["@graph"])) {
      nodes.push(...flattenJsonNodes(obj["@graph"]));
    }
    if (Array.isArray(obj.mainEntity)) {
      nodes.push(...flattenJsonNodes(obj.mainEntity));
    }
    if (Array.isArray(obj.itemListElement)) {
      nodes.push(...flattenJsonNodes(obj.itemListElement));
    }

    return nodes;
  }

  return [];
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
