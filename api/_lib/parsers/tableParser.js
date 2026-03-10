import { BaseParser } from "./base.js";
import { clean, cleanPhone, decodeEntities, stripTags, normalizeText, extractCoords } from "./parserUtils.js";

class TableParser extends BaseParser {
  get key() { return "table_auto_v1"; }

  canParse(html) {
    return /<table[\s\S]*?<\/table>/i.test(html);
  }

  parse(html) {
    const tables = extractTables(html);
    if (!tables.length) return [];

    const best = tables.reduce((a, b) => (b.rows.length > a.rows.length ? b : a), { rows: [] });
    if (best.rows.length < 2) return [];

    let headerIdx = -1;
    let cols = null;
    for (let i = 0; i < Math.min(4, best.rows.length); i++) {
      const c = detectTableCols(best.rows[i].cells);
      if (c.name >= 0) { headerIdx = i; cols = c; break; }
    }
    if (!cols) return [];

    const results = [];
    for (let i = headerIdx + 1; i < best.rows.length; i++) {
      const { cells, rawHtml } = best.rows[i];
      const name = clean(cells[cols.name] ?? "");
      if (!name || name.length < 3) continue;
      const coords = extractCoords(rawHtml);
      results.push({
        name,
        address:  cols.address  >= 0 ? clean(cells[cols.address]  ?? "") : "",
        phone:    cols.phone    >= 0 ? cleanPhone(cells[cols.phone] ?? "") : "",
        district: cols.district >= 0 ? clean(cells[cols.district] ?? "") : "",
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {})
      });
    }
    return results;
  }
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
      if (cells.some((c) => c.trim())) rows.push({ cells, rawHtml: rm[1] });
    }
    if (rows.length >= 2) tables.push({ rows });
  }
  return tables;
}

function detectTableCols(headers) {
  const cols = { name: -1, address: -1, phone: -1, district: -1 };
  headers.forEach((h, i) => {
    const n = normalizeText(h);
    if (cols.name     < 0 && /eczane|adi|name\b|isim/.test(n))           cols.name     = i;
    if (cols.address  < 0 && /adres|address/.test(n))                     cols.address  = i;
    if (cols.phone    < 0 && /telefon|tel\b|phone|gsm/.test(n))           cols.phone    = i;
    if (cols.district < 0 && /ilce|bolge|semt|district|mahalle/.test(n))  cols.district = i;
  });
  return cols;
}

export const tableParser = new TableParser();
