import { BaseParser } from "./base.js";
import { clean, cleanPhone, stripTags, extractCoords } from "./parserUtils.js";

class InlineBoxParser extends BaseParser {
  get key() { return "inline_box_v1"; }

  canParse(html) {
    return html.includes('data-name="') && html.includes('data-district="');
  }

  parse(html) {
    const results = [];
    const boxRe = /data-name="([^"]+)"[\s\S]{0,200}?data-district="([^"]+)"/g;
    let m;

    while ((m = boxRe.exec(html)) !== null) {
      const rawName     = m[1].trim();
      const rawDistrict = m[2].trim();

      const nextIdx = html.indexOf("data-name=", m.index + 10);
      const section = html.slice(m.index, nextIdx >= 0 ? nextIdx : m.index + 3000);

      const h4m  = section.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
      const name = h4m ? clean(stripTags(h4m[1])) : rawName;

      const pm = section.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      let address = "", phone = "";
      if (pm) {
        let pHtml = pm[1]
          .replace(/<svg[\s\S]*?<\/svg>/gi, "")
          .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "");
        const telM = pHtml.match(/href="tel:([^"]+)"/i) || pHtml.match(/<span[^>]*>([0-9 ()-]{7,})<\/span>/i);
        phone   = telM ? cleanPhone(telM[1]) : "";
        address = clean(stripTags(pHtml).replace(phone, "").replace(/\s{2,}/g, " "));
      }

      const coords = extractCoords(section);
      if (name.length >= 3) {
        results.push({
          name,
          address,
          phone,
          district: rawDistrict,
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {})
        });
      }
    }
    return results;
  }
}

export const inlineBoxParser = new InlineBoxParser();
