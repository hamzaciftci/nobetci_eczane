import { normalizeText, resolveToday } from "./normalizeLayer.js";
import { clean, cleanPhone, decodeEntities, stripTags } from "./utils.js";

// ─── Koordinat çıkarıcı ────────────────────────────────────────────────────
// Google Maps href'inden ?q=lat,lng koordinatlarını ayıklar.
function extractCoords(html) {
  const m = html.match(
    /href="https?:\/\/(?:maps\.google\.com|www\.google\.com\/maps)[^"]*[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/i
  );
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
}

/** Main HTML parse entry point — dispatches on parserKey, then auto-detects. */
export function parseHtmlPharmacies(html, parserKey = "generic_auto_v1") {
  if (!html) return [];

  // Explicit parser
  if (parserKey && parserKey !== "generic_auto_v1") {
    const rows = dispatchParser(html, parserKey);
    if (rows.length) return rows;
  }

  // Auto-detection
  const tableRows = tableParser(html);
  if (tableRows.length >= 2) return tableRows;

  const inlineRows = inlineBoxParser(html);
  if (inlineRows.length >= 2) return inlineRows;

  const cardRows = cardParser(html);
  if (cardRows.length >= 2) return cardRows;

  const antalyaRows = antalyaParser(html);
  if (antalyaRows.length >= 1) return antalyaRows;

  const iconRows = iconUserMdParser(html);
  if (iconRows.length >= 1) return iconRows;

  const teknoV1Rows = teknoEczaV1Parser(html);
  if (teknoV1Rows.length >= 1) return teknoV1Rows;

  const teknoV2Rows = teknoEczaV2Parser(html);
  if (teknoV2Rows.length >= 1) return teknoV2Rows;

  const amasyaRows = eczaneIsmiParser(html);
  if (amasyaRows.length >= 1) return amasyaRows;

  const trendRows = trendItemParser(html);
  if (trendRows.length >= 1) return trendRows;

  const karamanRows = karamanParser(html);
  if (karamanRows.length >= 1) return karamanRows;

  return [];
}

/** Parse pharmacy rows from a JSON API response. */
export function parseJsonPharmacies(data, _parserKey) {
  if (data?.html && typeof data.html === "string") {
    return parseHtmlPharmacies(data.html);
  }

  const items = Array.isArray(data)
    ? data
    : data?.data ?? data?.pharmacies ?? data?.result ?? data?.items ?? [];
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      name: String(item.name ?? item.pharmacy_name ?? item.eczane ?? item.ad ?? "").trim(),
      address: String(item.address ?? item.adres ?? item.addr ?? "").trim(),
      phone: String(item.phone ?? item.telefon ?? item.tel ?? "").trim(),
      district: String(item.district ?? item.ilce ?? item.district_name ?? "").trim()
    }))
    .filter((r) => r.name.length >= 3);
}

export function detectAjaxApiUrl(html, endpointUrl) {
  if (!html) return null;

  const m1 = html.match(/["'](https?:\/\/[^"']+\/getPharm(?:acies)?\/?)["']\s*\+\s*\w+/i);
  if (m1) {
    const today = resolveToday();
    return m1[1].replace(/\/+$/, "") + "/" + today;
  }

  const m2 = html.match(/url\s*=\s*["'](\/[^"']*getPharm(?:acies)?\/?)["']\s*\+/i);
  if (m2 && endpointUrl) {
    const base = new URL(endpointUrl).origin;
    const today = resolveToday();
    return base + m2[1].replace(/\/+$/, "") + "/" + today;
  }

  return null;
}

// ─── Parser dispatch ─────────────────────────────────────────────────────

function dispatchParser(html, parserKey) {
  if (parserKey.includes("table")) return tableParser(html);
  if (parserKey.includes("inline_box") || parserKey.includes("inlinebox")) return inlineBoxParser(html);
  if (parserKey.includes("card")) return cardParser(html);
  if (parserKey.includes("antalya") || parserKey.includes("nobetci_div")) return antalyaParser(html);
  if (parserKey.includes("icon_user_md") || parserKey.includes("iconusermd")) return iconUserMdParser(html);
  if (parserKey.includes("eczaneismi") || parserKey.includes("amasya")) return eczaneIsmiParser(html);
  if (parserKey.includes("trend_item") || parserKey.includes("isparta")) return trendItemParser(html);
  if (parserKey.includes("karaman") || parserKey.includes("vatan_hl")) return karamanParser(html);
  if (parserKey.includes("teknoecza_v1") || parserKey.includes("teknoecza1")) return teknoEczaV1Parser(html);
  if (parserKey.includes("teknoecza_v2") || parserKey.includes("teknoecza2")) return teknoEczaV2Parser(html);
  if (parserKey.includes("konya_v1")) return konyaV1Parser(html);
  return [];
}

// ─── Strategy 1: HTML tables ─────────────────────────────────────────────

function tableParser(html) {
  const tables = extractTables(html);
  let best = tables.reduce((a, b) => (b.rows.length > a.rows.length ? b : a), { rows: [] });
  if (best.rows.length < 2) return [];

  let headerIdx = -1;
  let cols = null;
  for (let i = 0; i < Math.min(4, best.rows.length); i++) {
    const c = detectTableCols(best.rows[i]);
    if (c.name >= 0) {
      headerIdx = i;
      cols = c;
      break;
    }
  }
  if (!cols) return [];

  const results = [];
  for (let i = headerIdx + 1; i < best.rows.length; i++) {
    const cells = best.rows[i];
    const name = clean(cells[cols.name] ?? "");
    if (!name || name.length < 3) continue;
    results.push({
      name,
      address: cols.address >= 0 ? clean(cells[cols.address] ?? "") : "",
      phone: cols.phone >= 0 ? cleanPhone(cells[cols.phone] ?? "") : "",
      district: cols.district >= 0 ? clean(cells[cols.district] ?? "") : ""
    });
  }
  return results;
}

function extractTables(html) {
  const tables = [];
  const tblRe = /<table[\s\S]*?>([\s\S]*?)<\/table>/gi;
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
      if (cells.some((c) => c.trim())) rows.push(cells);
    }
    if (rows.length >= 2) tables.push({ rows });
  }
  return tables;
}

function detectTableCols(headers) {
  const cols = { name: -1, address: -1, phone: -1, district: -1 };
  headers.forEach((h, i) => {
    const n = normalizeText(h);
    if (cols.name < 0 && /eczane|adi|name\b|isim/.test(n)) cols.name = i;
    if (cols.address < 0 && /adres|address/.test(n)) cols.address = i;
    if (cols.phone < 0 && /telefon|tel\b|phone|gsm/.test(n)) cols.phone = i;
    if (cols.district < 0 && /ilce|bolge|semt|district|mahalle/.test(n)) cols.district = i;
  });
  return cols;
}

// ─── Strategy 2: inline-box with data-name/data-district ────────────────

function inlineBoxParser(html) {
  const results = [];
  const boxRe = /data-name="([^"]+)"[\s\S]{0,200}?data-district="([^"]+)"/g;
  let m;

  while ((m = boxRe.exec(html)) !== null) {
    const rawName = m[1].trim();
    const rawDistrict = m[2].trim();

    const nextIdx = html.indexOf("data-name=", m.index + 10);
    const section = html.slice(m.index, nextIdx >= 0 ? nextIdx : m.index + 3000);

    const h4m = section.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    const name = h4m ? clean(stripTags(h4m[1])) : rawName;

    const pm = section.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    let address = "",
      phone = "";
    if (pm) {
      let pHtml = pm[1].replace(/<svg[\s\S]*?<\/svg>/gi, "").replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "");

      const telM = pHtml.match(/href="tel:([^"]+)"/i) || pHtml.match(/<span[^>]*>([0-9 ()-]{7,})<\/span>/i);
      phone = telM ? cleanPhone(telM[1]) : "";

      const stripped = clean(stripTags(pHtml));
      address = clean(stripped.replace(phone, "").replace(/\s{2,}/g, " "));
    }

    const coords = extractCoords(section);

    if (name.length >= 3) {
      results.push({ name, address, phone, district: rawDistrict, ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) });
    }
  }
  return results;
}

// ─── Strategy 3: Bootstrap card-divs (most sites) ───────────────────────

function cardParser(html) {
  const headingRe = /<h[1-5][^>]*>([\s\S]*?)<\/h[1-5]>/gi;
  const headings = [];
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
    const h = headings[i];
    const nextIdx = headings[i + 1]?.idx ?? html.length;
    const section = html.slice(h.idx, Math.min(nextIdx, h.idx + 2500));

    let name = h.text;
    let district = "";

    if (/ECZANELER|eczaneler/i.test(name)) {
      const districtOnly = name
        .replace(/\s*BUGÜN\s+/i, " ")
        .replace(/\s*NÖBETÇİ\s+ECZANELER.*/i, "")
        .replace(/\s*ECZANELER.*/i, "")
        .replace(/\s*HAFTALIK\s+.*/i, "")
        .replace(/\s*\d{2}[\-\.\/]\d{2}[\-\.\/]\d{4}.*/g, "")
        .trim();
      if (districtOnly.length >= 3 && districtOnly.length <= 40 && !districtOnly.toLowerCase().includes("eczac")) {
        currentSectionDistrict = districtOnly;
      }
      continue;
    }

    const dashM = name.match(/^(.+?)\s+-\s+(.+)$/);
    if (dashM && !dashM[2].toLowerCase().includes("eczane")) {
      name = dashM[1].trim();
      district = dashM[2].trim();
    }

    if (!district) {
      const arrowM = section.match(/fa-arrow-right[^>]*(?:><\/i>|>)\s*([\s\S]{1,60}?)(?:<br|<\/span|<i\s)/i);
      if (arrowM) district = clean(stripTags(arrowM[1]));
    }

    if (!district) {
      const h5M = section.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i);
      if (h5M) {
        const h5text = clean(stripTags(h5M[1]));
        if (h5text.length >= 2 && h5text.length <= 40 && !/ecz/i.test(h5text)) {
          district = h5text;
        }
      }
    }

    if (!district && currentSectionDistrict) {
      district = currentSectionDistrict;
    }

    const telM = section.match(/href="tel:([^"]+)"/i);
    let phone = "";
    if (telM) {
      phone = cleanPhone(telM[1]);
    } else {
      const phonePlainM = section.match(/(?:fa-phone|icon-phone)[^>]*(?:><\/i>|>)\s*([\d\s()+\-]{7,20}?)(?:<br|<\/|<i|<a)/i);
      if (phonePlainM) phone = cleanPhone(phonePlainM[1]);
    }

    let address = "";
    // Capture full address block from fa-home to next fa- icon (includes description line after <br>)
    const homeM =
      section.match(/fa-(?:home|address-card)[^>]*(?:><\/i>|>)\s*([\s\S]{3,600}?)(?=<i\s[^>]*fa-(?:phone|map-marker|whatsapp|envelope|fax))/i) ||
      section.match(/(?:icon-home)[^>]*(?:><\/i>|>)\s*([\s\S]{3,400}?)(?:<br\s*\/?>|<a\s|<\/p|<i\s)/i);
    if (homeM) {
      address = clean(stripTags(homeM[1]));
    } else {
      const mapM = section.match(/fa-map-marker[^>]*(?:><\/i>|>)\s*((?:(?!<a)[^<]|<[^a/]){3,300}?)(?:<br\s*\/?>|<\/p|<\/div|<i\s)/i);
      if (mapM) {
        const candidate = clean(stripTags(mapM[1]));
        if (candidate.length >= 5 && !/harita|konum|map/i.test(candidate)) {
          address = candidate;
        }
      }
    }

    const coords = extractCoords(section);

    if (!phone && !address) continue;
    if (name.length >= 3) {
      results.push({ name, district, address, phone, ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) });
    }
  }

  return results;
}

// ─── Strategy 4: Antalya .nobetciDiv ─────────────────────────────────────

function antalyaParser(html) {
  if (!html.includes("nobetciDiv")) return [];
  const results = [];
  const re = /nobetciDiv[\s\S]{0,800}?href="tel:([^"]+)"[\s\S]{0,200}?href="tel:([^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const matchStr = m[0]; // nobetciDiv … second tel href
    const afterStr = html.slice(m.index + m[0].length, m.index + m[0].length + 800);
    const fullBlock = matchStr + afterStr;

    // Old format: name in <h4>; new format (aeo.org.tr): name as first tel-link text
    const h4m = matchStr.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    let name = h4m ? clean(stripTags(h4m[1])) : "";
    if (!name) {
      const telNameM = matchStr.match(/<a href="tel:[^"]*">([^<]+)<\/a>/i);
      if (telNameM) name = clean(telNameM[1]);
    }

    // Address: maps link (new format) or fa-home icon (old format)
    let address = "";
    const mapsM = fullBlock.match(/maps\.google\.com[^"]*"[^>]*class="nadres"[^>]*>([\s\S]{0,300}?)<\/a>/i);
    if (mapsM) {
      address = clean(stripTags(mapsM[1]));
    } else {
      const addrM = fullBlock.match(/fa-home[^>]*(?:><\/i>|>)\s*([\s\S]{3,400}?)(?:<br|<\/p|<i\s)/i);
      if (addrM) address = clean(stripTags(addrM[1]));
    }

    const phone = cleanPhone(m[1] || m[2]);
    const coords = extractCoords(fullBlock);
    if (name && name.length >= 3) {
      results.push({ name, address, phone, district: "", ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) });
    }
  }
  return results;
}

// ─── Strategy 9: TeknoEcza v1 — <a title="Nöbetçi Eczane">NAME</a> (Niğde) ─

function teknoEczaV1Parser(html) {
  if (!html.includes("N\u00f6bet\u00e7i Eczane")) return [];
  const results = [];
  // <a ... title="Nöbetçi Eczane">NAME</a> <span ...>(DISTRICT)</span>
  const re = /title="N\u00f6bet\u00e7i Eczane"[^>]*>([^<]+)<\/a>[\s\S]{0,120}<span[^>]*>\(([^)]+)\)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = clean(m[1]);
    const district = m[2].trim();
    if (name.length >= 3) results.push({ name, district, address: "", phone: "" });
  }
  if (results.length) return results;
  // Fallback: no district span
  const re2 = /title="N\u00f6bet\u00e7i Eczane"[^>]*>([^<]+)<\/a>/gi;
  let m2;
  while ((m2 = re2.exec(html)) !== null) {
    const name = clean(m2[1]);
    if (name.length >= 3) results.push({ name, district: "", address: "", phone: "" });
  }
  return results;
}

// ─── Strategy 10: TeknoEcza v2 — marquee <a href="nobetci-eczaneler"> (Aydın) ─

function teknoEczaV2Parser(html) {
  if (!html.includes('href="nobetci-eczaneler"')) return [];
  const results = [];
  // <a href="nobetci-eczaneler" title="Bugün...">NAME / <strong><small>DISTRICT</small>
  const re = /href="nobetci-eczaneler"[^>]*title="Bug\u00fcn[^"]*"[^>]*>([^/<]+)\s*\/\s*<strong><small>([^<]+)<\/small>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = clean(m[1]);
    const district = m[2].trim();
    if (name.length >= 2) results.push({ name, district, address: "", phone: "" });
  }
  return results;
}

// ─── Strategy 5: icon-user-md blocks ─────────────────────────────────────

function iconUserMdParser(html) {
  if (!html.includes("icon-user-md") && !html.includes("icon-user")) return [];
  const results = [];
  const blockRe = /icon-user-md[\s\S]{0,1200}?icon-home/gi;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const block = html.slice(m.index, Math.min(html.length, m.index + 1200));
    const nameM = block.match(/icon-user-md[^>]*(?:><\/i>|>)\s*([\s\S]{1,200}?)(?:<br|<\/)/i);
    const name = nameM ? clean(stripTags(nameM[1])) : "";
    if (!name || name.length < 3) continue;

    const addrM = block.match(/icon-home[^>]*(?:><\/i>|>)\s*([\s\S]{3,300}?)(?:<br|<\/p|<\/div|<i\s)/i);
    const address = addrM ? clean(stripTags(addrM[1])) : "";

    const telM = block.match(/href="tel:([^"]+)"/i) || block.match(/icon-phone[^>]*(?:><\/i>|>)\s*([\d\s()+\-]{7,20}?)(?:<br|<\/|<i|<a)/i);
    const phone = telM ? cleanPhone(telM[1]) : "";

    const coords = extractCoords(block);
    results.push({ name, district: "", address, phone, ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) });
  }
  return results;
}

// ─── Strategy 6: .eczaneismi / .eczaneadres (Amasya) ────────────────────

function eczaneIsmiParser(html) {
  if (!html.includes("eczaneismi")) return [];
  const results = [];
  const re = /eczaneismi[^>]*>([\s\S]*?)<\/[^>]+>[\s\S]{0,400}?eczaneadres[^>]*>([\s\S]*?)<\/[^>]+>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = clean(stripTags(m[1]));
    const address = clean(stripTags(m[2]));
    if (name.length >= 3) {
      results.push({ name, address, phone: "", district: "" });
    }
  }
  return results;
}

// ─── Strategy 7: trend-item cards (Isparta) ─────────────────────────────

function trendItemParser(html) {
  if (!html.includes("trend-item")) return [];
  const results = [];
  const cardRe = /class="[^"]*trend-item[^"]*"[\s\S]{0,1200}?icon-home/gi;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const block = html.slice(m.index, Math.min(html.length, m.index + 1200));
    const h3M = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (!h3M) continue;
    const name = clean(stripTags(h3M[1]));
    if (name.length < 3 || !/ecz/i.test(name)) continue;

    const h5M = block.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i);
    const district = h5M ? clean(stripTags(h5M[1])) : "";

    const addrM = block.match(/fa-map-marker[^>]*(?:><\/i>|>)\s*([\s\S]{3,300}?)(?:<br|<\/p|<\/div|<i\s|<a\s)/i);
    let address = "";
    if (addrM) {
      const candidate = clean(stripTags(addrM[1]));
      if (!/harita|konum|map/i.test(candidate)) address = candidate;
    }

    const telM = block.match(/href="tel:([^"]+)"/i);
    let phone = "";
    if (telM) {
      phone = cleanPhone(telM[1]);
    } else {
      const phonePlainM = block.match(/fa-phone[^>]*(?:><\/i>|>)\s*([\d\s()+\-]{7,20}?)(?:<br|<\/|<i|<a)/i);
      if (phonePlainM) phone = cleanPhone(phonePlainM[1]);
    }

    const coords = extractCoords(block);
    if (name.length >= 3 && (phone || address)) {
      results.push({ name, district, address, phone, ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) });
    }
  }

  return results;
}

// ─── Strategy 8: vatan_hl + icon-home (Karaman) ─────────────────────────

function karamanParser(html) {
  if (!html.includes("vatan_hl") || !html.includes("icon-home")) return [];
  const results = [];

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

  const homeRe = /icon-home[^>]*(?:><\/i>|>)\s*([\s\S]{3,300}?)(?:<br\s*\/?>|<\/p|<i\s)/gi;
  let hm;
  while ((hm = homeRe.exec(html)) !== null) {
    const address = clean(stripTags(hm[1]));
    if (!address || address.length < 5) continue;

    const nearestDist = distHeaders.filter((d) => d.idx < hm.index).sort((a, b) => b.idx - a.idx)[0];
    const district = nearestDist?.district ?? "";

    const before = html.slice(Math.max(0, hm.index - 800), hm.index);
    const h4all = [...before.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)];
    if (!h4all.length) continue;
    const name = clean(stripTags(h4all[h4all.length - 1][1]));
    if (!name || name.length < 2) continue;
    if (/eczaneler|nöbetçi/i.test(name)) continue;

    const after = html.slice(hm.index + hm[0].length, hm.index + hm[0].length + 500);
    const telM = after.match(/href="tel:([^"]+)"/i);
    let phone = "";
    if (telM) {
      phone = cleanPhone(telM[1]);
    } else {
      const phoneM = after.match(/icon-phone[^>]*(?:><\/i>|>)\s*([\d\s()+\-]{7,20}?)(?:<br|<\/|<i|<a)/i);
      if (phoneM) phone = cleanPhone(phoneM[1]);
    }

    const coords = extractCoords(after);
    if (name.length >= 2 && (address || phone)) {
      results.push({ name, district, address, phone, ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) });
    }
  }

  return results;
}

// ─── Strategy 11: Konya nested-table — direct TR/TD scan ─────────────────
// konyanobetcieczaneleri.com uses nested <table> per address cell, breaking
// the standard extractTables() regex. We scan all TRs from raw HTML instead.

function konyaV1Parser(html) {
  if (!html.includes("baslik_eczane") && !html.includes("konyanobetci")) return [];
  const results = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  let nameCol = 1; // default: Eczane is usually col 1

  while ((m = trRe.exec(html)) !== null) {
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cm;
    while ((cm = tdRe.exec(m[1])) !== null) {
      cells.push(decodeEntities(stripTags(cm[1])).replace(/\s+/g, " ").trim());
    }
    if (cells.length < 2) continue;

    // Header row: contains exact "Eczane" cell
    if (cells.some(c => /^eczane$/i.test(c))) {
      nameCol = cells.findIndex(c => /^eczane$/i.test(c));
      continue;
    }

    if (cells.length <= nameCol) continue;
    const name = cells[nameCol] ?? "";
    if (name.length < 2) continue;
    // Skip header-like or footer cells
    if (/bugün|nöbetçi|eczaneler|hastalar|^adres$|^telefon$|^bölge$|bölge eczane/i.test(name)) continue;

    const district = cells[0] ?? "";
    results.push({
      name: clean(name),
      district: clean(district),
      address: "",
      phone: ""
    });
  }
  return results;
}
