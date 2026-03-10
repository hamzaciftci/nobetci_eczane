import { BaseParser } from "./base.js";
import { clean, cleanPhone, stripTags, extractCoords } from "./parserUtils.js";

class CardParser extends BaseParser {
  get key() { return "card_auto_v1"; }

  canParse(html) {
    // ECZ içeren h1–h5 heading var mı?
    return /<h[1-5][^>]*>[\s\S]*?ECZ[\s\S]*?<\/h[1-5]>/i.test(html);
  }

  parse(html) {
    const headingRe = /<h[1-5][^>]*>([\s\S]*?)<\/h[1-5]>/gi;
    const headings  = [];
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
      const h       = headings[i];
      const nextIdx = headings[i + 1]?.idx ?? html.length;
      const section = html.slice(h.idx, Math.min(nextIdx, h.idx + 2500));

      let name     = h.text;
      let district = "";

      if (/ECZANELER|eczaneler/i.test(name)) {
        const districtOnly = name
          .replace(/\s*BUGÜN\s+/i, " ")
          .replace(/\s*NÖBETÇİ\s+ECZANELER.*/i, "")
          .replace(/\s*ECZANELER.*/i, "")
          .replace(/\s*HAFTALIK\s+.*/i, "")
          .replace(/\s*\d{2}[\-./]\d{2}[\-./]\d{4}.*/g, "")
          .trim();
        if (districtOnly.length >= 3 && districtOnly.length <= 40 && !districtOnly.toLowerCase().includes("eczac")) {
          currentSectionDistrict = districtOnly;
        }
        continue;
      }

      const dashM = name.match(/^(.+?)\s+-\s+(.+)$/);
      if (dashM && !dashM[2].toLowerCase().includes("eczane")) {
        name     = dashM[1].trim();
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
          if (h5text.length >= 2 && h5text.length <= 40 && !/ecz/i.test(h5text)) district = h5text;
        }
      }
      if (!district && currentSectionDistrict) district = currentSectionDistrict;

      const telM = section.match(/href="tel:([^"]+)"/i);
      let phone = "";
      if (telM) {
        phone = cleanPhone(telM[1]);
      } else {
        const phonePlainM = section.match(/(?:fa-phone|icon-phone)[^>]*(?:><\/i>|>)\s*([\d\s()+\-]{7,20}?)(?:<br|<\/|<i|<a)/i);
        if (phonePlainM) phone = cleanPhone(phonePlainM[1]);
      }

      let address = "";
      const homeM =
        section.match(/fa-(?:home|address-card)[^>]*(?:><\/i>|>)\s*([\s\S]{3,600}?)(?=<i\s[^>]*fa-(?:phone|map-marker|whatsapp|envelope|fax))/i) ||
        section.match(/(?:icon-home)[^>]*(?:><\/i>|>)\s*([\s\S]{3,400}?)(?:<br\s*\/?> |<a\s|<\/p|<i\s)/i);
      if (homeM) {
        address = clean(stripTags(homeM[1]));
      } else {
        const mapM = section.match(/fa-map-marker[^>]*(?:><\/i>|>)\s*((?:(?!<a)[^<]|<[^a/]){3,300}?)(?:<br\s*\/?> |<\/p|<\/div|<i\s)/i);
        if (mapM) {
          const candidate = clean(stripTags(mapM[1]));
          if (candidate.length >= 5 && !/harita|konum|map/i.test(candidate)) address = candidate;
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
}

export const cardParser = new CardParser();
