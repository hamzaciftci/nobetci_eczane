/**
 * Özel / il-bazlı parser'lar.
 * Antalya, Osmaniye, TeknoEcza v1/v2, Yandex, Karaman, Konya, Amasya, Isparta, İstanbul.
 */
import { BaseParser } from "./base.js";
import { clean, cleanPhone, stripTags, decodeEntities, extractCoords } from "./parserUtils.js";

// ─── Antalya .nobetciDiv ──────────────────────────────────────────────────────
class AntalyaParser extends BaseParser {
  get key() { return "antalya_nobetci_div_v1"; }
  canParse(html) { return html.includes("nobetciDiv"); }

  parse(html) {
    const results = [];
    const re = /nobetciDiv[\s\S]{0,800}?href="tel:([^"]+)"[\s\S]{0,200}?href="tel:([^"]+)"/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const matchStr  = m[0];
      const afterStr  = html.slice(m.index + m[0].length, m.index + m[0].length + 800);
      const fullBlock = matchStr + afterStr;

      const h4m = matchStr.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
      let name  = h4m ? clean(stripTags(h4m[1])) : "";
      if (!name) {
        const telNameM = matchStr.match(/<a href="tel:[^"]*">([^<]+)<\/a>/i);
        if (telNameM) name = clean(telNameM[1]);
      }

      let address = "";
      const mapsM = fullBlock.match(/maps\.google\.com[^"]*"[^>]*class="nadres"[^>]*>([\s\S]{0,300}?)<\/a>/i);
      if (mapsM) {
        address = clean(stripTags(mapsM[1]));
      } else {
        const addrM = fullBlock.match(/fa-home[^>]*(?:><\/i>|>)\s*([\s\S]{3,400}?)(?:<br|<\/p|<i\s)/i);
        if (addrM) address = clean(stripTags(addrM[1]));
      }

      const phone  = cleanPhone(m[1] || m[2]);
      const coords = extractCoords(fullBlock);
      if (name && name.length >= 3) {
        results.push({ name, address, phone, district: "", ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) });
      }
    }
    return results;
  }
}

// ─── Osmaniye Eczacı Odası POST form ─────────────────────────────────────────
class OsmaniyeParser extends BaseParser {
  get key() { return "osmaniye_eo_v1"; }
  canParse(html) { return html.includes("nobet-kart"); }

  parse(html) {
    if (!html.includes("nobet-kart")) return [];
    const results = [];
    const cardRe = /<div[^>]*class="[^"]*nobet-kart[^"]*"[^>]*>([\s\S]*?)<hr>/gi;
    let m;

    while ((m = cardRe.exec(html)) !== null) {
      const block  = m[1];
      const h4     = block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1] ?? "";
      const h4Text = clean(stripTags(h4));

      let name =
        clean(stripTags(h4.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)?.[1] ?? "")) || "";
      if (!name && h4Text) {
        name = h4Text
          .replace(/^\d{2}\.\d{2}\.\d{4}\s*\/\s*/i, "")
          .replace(/^OSMAN[Iİ]YE\s+[A-ZÇĞİÖŞÜ]+\s+/i, "")
          .trim();
      }
      if (!name) continue;

      let district = "";
      const distDash = h4Text.match(/-\s*([A-ZÇĞİÖŞÜ ]{2,40})$/i);
      if (distDash) district = clean(distDash[1]);
      if (!district) {
        const distSlash = h4Text.match(/\/\s*OSMAN[Iİ]YE\s+([A-ZÇĞİÖŞÜ]{2,40})/i);
        if (distSlash) district = clean(distSlash[1]);
      }

      const addrM =
        block.match(/fa-home[^>]*(?:><\/i>|>)\s*([\s\S]{3,700}?)(?=<br\s*\/?>\s*<i[^>]*fa-phone|<i[^>]*fa-phone|<\/p>)/i) ||
        block.match(/fa-home[^>]*(?:><\/i>|>)\s*([\s\S]{3,700}?)(?=<a[^>]+href="tel:)/i);
      const address = addrM ? clean(stripTags(addrM[1])) : "";

      const telM  = block.match(/href="tel:([^"]+)"/i);
      const phone = telM ? cleanPhone(telM[1]) : "";
      const coords = extractCoords(block);

      if (name.length >= 2) {
        results.push({ name, district, address, phone, ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) });
      }
    }
    return results;
  }
}

// ─── TeknoEcza v1 (Niğde ve benzeri) ─────────────────────────────────────────
class TeknoEczaV1Parser extends BaseParser {
  get key() { return "teknoecza_v1"; }
  canParse(html) { return html.includes("Nöbetçi Eczane") || html.includes("N\u00f6bet\u00e7i Eczane"); }

  parse(html) {
    const results = [];

    // Strateji A: <a title="Nöbetçi Eczane">NAME</a> <span>(DISTRICT)</span>
    const re = /title="N\u00f6bet\u00e7i Eczane"[^>]*>([^<]+)<\/a>[\s\S]{0,120}<span[^>]*>\(([^)]+)\)/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const name = clean(m[1]);
      if (name.length >= 3) results.push({ name, district: m[2].trim(), address: "", phone: "" });
    }
    if (results.length) return results;

    // Strateji B: title="Nöbetçi Eczane" ama district span yok
    const re2 = /title="N\u00f6bet\u00e7i Eczane"[^>]*>([^<]+)<\/a>/gi;
    let m2;
    while ((m2 = re2.exec(html)) !== null) {
      const name = clean(m2[1]);
      if (name.length >= 3) results.push({ name, district: "", address: "", phone: "" });
    }
    if (results.length) return results;

    // Strateji C: Oben/TeknoEcza ".eight columns" kart layoutu
    const blockRe = /<div class="eight columns bottom-1">([\s\S]{0,1800}?)(?:<p><hr><\/p>|<\/div>\s*<\/div>)/gi;
    let bm;
    while ((bm = blockRe.exec(html)) !== null) {
      const block = bm[1];
      const name  = clean(stripTags(block.match(/<strong>\s*([^<]*?ECZANES[İI]?)\s*<\/strong>/i)?.[1] ?? ""));
      if (name.length < 3) continue;
      const district = clean(stripTags(block.match(/icon-hand-right[^>]*(?:><\/i>|>)\s*([\s\S]{1,80}?)(?:<br|<i\s)/i)?.[1] ?? ""));
      const address  = clean(stripTags(block.match(/icon-home[^>]*(?:><\/i>|>)\s*([\s\S]{3,450}?)(?:<br|<i\s)/i)?.[1] ?? ""));
      const telM     = block.match(/href="tel:([^"]+)"/i) ||
                       block.match(/icon-phone[^>]*(?:><\/i>|>)\s*([\d\s()+\-]{7,20}?)(?:<br|<\/|<i|<a)/i);
      const phone    = telM ? cleanPhone(telM[1]) : "";
      const coords   = extractCoords(block);
      results.push({ name, district, address, phone, ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) });
    }
    return results;
  }
}

// ─── TeknoEcza v2 (Aydın marquee) ────────────────────────────────────────────
class TeknoEczaV2Parser extends BaseParser {
  get key() { return "teknoecza_v2"; }
  canParse(html) { return html.includes('href="nobetci-eczaneler"'); }

  parse(html) {
    if (!html.includes('href="nobetci-eczaneler"')) return [];
    const results = [];
    const re = /href="nobetci-eczaneler"[^>]*title="Bug\u00fcn[^"]*"[^>]*>([^/<]+)\s*\/\s*<strong><small>([^<]+)<\/small>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const name = clean(m[1]);
      if (name.length >= 2) results.push({ name, district: m[2].trim(), address: "", phone: "" });
    }
    return results;
  }
}

// ─── Yandex Placemark (Hatay ve benzeri) ─────────────────────────────────────
class YandexPlacemarkParser extends BaseParser {
  get key() { return "yandex_placemark_v1"; }
  canParse(html) { return /ymaps\.Placemark/i.test(html) && /balloonContent/i.test(html); }

  parse(html) {
    const results = [];
    const re = /ymaps\.Placemark\(\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]\s*,\s*\{\s*balloonContent:\s*'([\s\S]*?)'\s*\}/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const lat     = Number(m[1]);
      const lng     = Number(m[2]);
      const balloon = String(m[3] || "").replace(/\\'/g, "'");
      const name    = clean(stripTags(balloon.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)?.[1] ?? ""));
      const lines   = stripTags(balloon).replace(/\r/g, "").split(/\n+/).map((l) => clean(l)).filter(Boolean);
      const district = lines[1] ?? "";
      const phone    = cleanPhone(lines[2] ?? "");
      if (name.length >= 3) {
        results.push({ name, district, address: "", phone, ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}) });
      }
    }
    return results;
  }
}

// ─── icon-user-md blocks ─────────────────────────────────────────────────────
class IconUserMdParser extends BaseParser {
  get key() { return "icon_user_md_v1"; }
  canParse(html) { return html.includes("icon-user-md") || html.includes("icon-user"); }

  parse(html) {
    if (!html.includes("icon-user-md") && !html.includes("icon-user")) return [];
    const results = [];
    const blockRe = /icon-user-md[\s\S]{0,1200}?icon-home/gi;
    let m;
    while ((m = blockRe.exec(html)) !== null) {
      const block  = html.slice(m.index, Math.min(html.length, m.index + 1200));
      const nameM  = block.match(/icon-user-md[^>]*(?:><\/i>|>)\s*([\s\S]{1,200}?)(?:<br|<\/)/i);
      const name   = nameM ? clean(stripTags(nameM[1])) : "";
      if (!name || name.length < 3) continue;
      const addrM  = block.match(/icon-home[^>]*(?:><\/i>|>)\s*([\s\S]{3,300}?)(?:<br|<\/p|<\/div|<i\s)/i);
      const address = addrM ? clean(stripTags(addrM[1])) : "";
      const telM   = block.match(/href="tel:([^"]+)"/i) || block.match(/icon-phone[^>]*(?:><\/i>|>)\s*([\d\s()+\-]{7,20}?)(?:<br|<\/|<i|<a)/i);
      const phone  = telM ? cleanPhone(telM[1]) : "";
      const coords = extractCoords(block);
      results.push({ name, district: "", address, phone, ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) });
    }
    return results;
  }
}

// ─── .eczaneismi (Amasya) ─────────────────────────────────────────────────────
class EczaneIsmiParser extends BaseParser {
  get key() { return "eczaneismi_v1"; }
  canParse(html) { return html.includes("eczaneismi"); }

  parse(html) {
    if (!html.includes("eczaneismi")) return [];
    const results = [];
    const re = /eczaneismi[^>]*>([\s\S]*?)<\/[^>]+>[\s\S]{0,400}?eczaneadres[^>]*>([\s\S]*?)<\/[^>]+>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const name    = clean(stripTags(m[1]));
      const address = clean(stripTags(m[2]));
      if (name.length >= 3) results.push({ name, address, phone: "", district: "" });
    }
    return results;
  }
}

// ─── trend-item (Isparta) ─────────────────────────────────────────────────────
class TrendItemParser extends BaseParser {
  get key() { return "trend_item_v1"; }
  canParse(html) { return html.includes("trend-item"); }

  parse(html) {
    if (!html.includes("trend-item")) return [];
    const results = [];
    const cardRe = /class="[^"]*trend-item[^"]*"[\s\S]{0,1200}?icon-home/gi;
    let m;
    while ((m = cardRe.exec(html)) !== null) {
      const block  = html.slice(m.index, Math.min(html.length, m.index + 1200));
      const h3M    = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      if (!h3M) continue;
      const name   = clean(stripTags(h3M[1]));
      if (name.length < 3 || !/ecz/i.test(name)) continue;
      const h5M    = block.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i);
      const district = h5M ? clean(stripTags(h5M[1])) : "";
      const addrM  = block.match(/fa-map-marker[^>]*(?:><\/i>|>)\s*([\s\S]{3,300}?)(?:<br|<\/p|<\/div|<i\s|<a\s)/i);
      let address  = "";
      if (addrM) {
        const cand = clean(stripTags(addrM[1]));
        if (!/harita|konum|map/i.test(cand)) address = cand;
      }
      const telM   = block.match(/href="tel:([^"]+)"/i);
      let phone    = "";
      if (telM) {
        phone = cleanPhone(telM[1]);
      } else {
        const pp = block.match(/fa-phone[^>]*(?:><\/i>|>)\s*([\d\s()+\-]{7,20}?)(?:<br|<\/|<i|<a)/i);
        if (pp) phone = cleanPhone(pp[1]);
      }
      const coords = extractCoords(block);
      if (name.length >= 3 && (phone || address)) {
        results.push({ name, district, address, phone, ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) });
      }
    }
    return results;
  }
}

// ─── vatan_hl + icon-home (Karaman) ──────────────────────────────────────────
class KaramanParser extends BaseParser {
  get key() { return "karaman_vatan_hl_v1"; }
  canParse(html) { return html.includes("vatan_hl") && html.includes("icon-home"); }

  parse(html) {
    if (!html.includes("vatan_hl") || !html.includes("icon-home")) return [];
    const results = [];

    const distHeaders = [];
    const distRe = /<h2[^>]*class="[^"]*vatan_hl[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi;
    let dm;
    while ((dm = distRe.exec(html)) !== null) {
      const text = clean(stripTags(dm[1]))
        .replace(/\s*nöbetçi\s+eczaneler?/i, "")
        .replace(/\s*nobetci\s+eczaneler?/i, "")
        .replace(/\s*\d{1,2}[\-./]\d{1,2}[\-./]\d{2,4}.*/g, "")
        .trim();
      if (text.length >= 2 && text.length <= 50) distHeaders.push({ idx: dm.index, district: text });
    }

    const homeRe = /icon-home[^>]*(?:><\/i>|>)\s*([\s\S]{3,300}?)(?:<br\s*\/?> |<\/p|<i\s)/gi;
    let hm;
    while ((hm = homeRe.exec(html)) !== null) {
      const address = clean(stripTags(hm[1]));
      if (!address || address.length < 5) continue;
      const nearestDist = distHeaders.filter((d) => d.idx < hm.index).sort((a, b) => b.idx - a.idx)[0];
      const district    = nearestDist?.district ?? "";
      const before      = html.slice(Math.max(0, hm.index - 800), hm.index);
      const h4all       = [...before.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)];
      if (!h4all.length) continue;
      const name = clean(stripTags(h4all[h4all.length - 1][1]));
      if (!name || name.length < 2) continue;
      if (/eczaneler|nöbetçi/i.test(name)) continue;
      const after  = html.slice(hm.index + hm[0].length, hm.index + hm[0].length + 500);
      const telM   = after.match(/href="tel:([^"]+)"/i);
      let phone    = "";
      if (telM) { phone = cleanPhone(telM[1]); } else {
        const pp = after.match(/icon-phone[^>]*(?:><\/i>|>)\s*([\d\s()+\-]{7,20}?)(?:<br|<\/|<i|<a)/i);
        if (pp) phone = cleanPhone(pp[1]);
      }
      const coords = extractCoords(after);
      if (name.length >= 2 && (address || phone)) {
        results.push({ name, district, address, phone, ...(coords ? { lat: coords.lat, lng: coords.lng } : {}) });
      }
    }
    return results;
  }
}

// ─── Konya nested-table ───────────────────────────────────────────────────────
class KonyaV1Parser extends BaseParser {
  get key() { return "konya_v1"; }
  canParse(html) { return html.includes("baslik_eczane") || html.includes("konyanobetci"); }

  parse(html) {
    if (!html.includes("baslik_eczane") && !html.includes("konyanobetci")) return [];
    const results = [];
    const trRe    = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    let nameCol   = 1;

    while ((m = trRe.exec(html)) !== null) {
      const cells = [];
      const tdRe  = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cm;
      while ((cm = tdRe.exec(m[1])) !== null) {
        cells.push(decodeEntities(stripTags(cm[1])).replace(/\s+/g, " ").trim());
      }
      if (cells.length < 2) continue;
      if (cells.some((c) => /^eczane$/i.test(c))) {
        nameCol = cells.findIndex((c) => /^eczane$/i.test(c));
        continue;
      }
      if (cells.length <= nameCol) continue;
      const name = cells[nameCol] ?? "";
      if (name.length < 2) continue;
      if (/bugün|nöbetçi|eczaneler|hastalar|^adres$|^telefon$|^bölge$|bölge eczane/i.test(name)) continue;
      results.push({ name: clean(name), district: clean(cells[0] ?? ""), address: "", phone: "" });
    }
    return results;
  }
}

// Exports
export const antalyaParser    = new AntalyaParser();
export const osmaniyeParser   = new OsmaniyeParser();
export const teknoEczaV1Parser = new TeknoEczaV1Parser();
export const teknoEczaV2Parser = new TeknoEczaV2Parser();
export const yandexParser     = new YandexPlacemarkParser();
export const iconUserMdParser = new IconUserMdParser();
export const eczaneIsmiParser = new EczaneIsmiParser();
export const trendItemParser  = new TrendItemParser();
export const karamanParser    = new KaramanParser();
export const konyaV1Parser    = new KonyaV1Parser();
