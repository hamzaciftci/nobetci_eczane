/**
 * Her sorunlu il için: fetch yap, HTML boyutu + içerik snippet göster,
 * mevcut parser ile kaç satır çıktığını göster.
 */
import { fetchResource } from "../api/_lib/ingest/fetchLayer.js";
import { parseHtmlPharmacies, detectAjaxApiUrl } from "../api/_lib/ingest/parserLayer.js";
import { readFileSync } from "fs";

const TARGETS = [
  { slug: "ankara",  url: "https://www.aeo.org.tr/nobetci-eczaneler",                         parser_key: "generic_auto_v1" },
  { slug: "antalya", url: "https://www.antalyaeo.org.tr/tr/nobetci-eczaneler",                 parser_key: "generic_auto_v1" },
  { slug: "aydin",   url: "https://www.aydineczaciodasi.org.tr/nobetci-4",                     parser_key: "generic_auto_v1" },
  { slug: "konya",   url: "https://keo.org.tr/kategori/nobetle-ilgili-462077/",               parser_key: "generic_auto_v1" },
  { slug: "nigde",   url: "https://www.neo.org.tr/nobetci-eczaneler",                          parser_key: "generic_auto_v1" },
  { slug: "ordu",    url: "https://ordueczaciodasi.org.tr/nobetci-eczaneler/",                 parser_key: "generic_auto_v1" },
];

for (const t of TARGETS) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`[${t.slug.toUpperCase()}] ${t.url}`);
  try {
    const fetched = await fetchResource(t.url);
    const html = fetched.html ?? "";
    console.log(`  HTTP   : ${fetched.status}`);
    console.log(`  HTML sz: ${html.length} bytes`);

    const rows = parseHtmlPharmacies(html, t.parser_key);
    console.log(`  Parsed : ${rows.length} rows`);

    if (rows.length > 0) {
      console.log(`  First 3:`);
      rows.slice(0, 3).forEach(r => console.log(`    - ${r.name} | ${r.district}`));
    } else {
      // AJAX fallback?
      const ajaxUrl = detectAjaxApiUrl(html, t.url);
      if (ajaxUrl) {
        console.log(`  AJAX URL found: ${ajaxUrl}`);
        const ajaxResult = await fetchResource(ajaxUrl);
        const ajaxRows = parseHtmlPharmacies(ajaxResult.html ?? "", t.parser_key);
        console.log(`  AJAX rows: ${ajaxRows.length}`);
        if (ajaxRows.length > 0) ajaxRows.slice(0,3).forEach(r => console.log(`    - ${r.name}`));
      }

      // HTML snippet — tablo yapısına bak
      const snippet = html.slice(0, 3000);
      const hasTable = html.includes("<table") || html.includes("<TABLE");
      const hasLi    = html.includes("<li") && html.includes("eczane");
      const tableCount = (html.match(/<table/gi) ?? []).length;
      const tdCount    = (html.match(/<td/gi) ?? []).length;
      const trCount    = (html.match(/<tr/gi) ?? []).length;
      console.log(`  Tables : ${tableCount}, TRs: ${trCount}, TDs: ${tdCount}, <li>: ${hasLi}`);

      // Meta keywords/title
      const titleMatch = html.match(/<title[^>]*>([^<]+)/i);
      const title = titleMatch ? titleMatch[1].trim() : "(no title)";
      console.log(`  Title  : ${title}`);

      // İlk 800 karakter snippet (JS/meta redirect var mı?)
      const bodyStart = html.indexOf("<body");
      const bodySnippet = bodyStart >= 0 ? html.slice(bodyStart, bodyStart + 600) : html.slice(0, 600);
      console.log(`  Body↓:\n${bodySnippet.replace(/\s+/g, " ").slice(0, 500)}`);
    }
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
  }
}
