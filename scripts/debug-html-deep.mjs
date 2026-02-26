/**
 * NO_SOURCE_DATA iller için HTML yapısını derinlemesine analiz eder.
 */
import { fetchResource } from "../api/_lib/ingest/fetchLayer.js";

const TARGETS = [
  { slug: "antalya", url: "https://www.antalyaeo.org.tr/tr/nobetci-eczaneler" },
  { slug: "aydin",   url: "https://www.aydineczaciodasi.org.tr/nobetci-4" },
  { slug: "konya",   url: "https://keo.org.tr/kategori/nobetle-ilgili-462077/" },
  { slug: "nigde",   url: "https://www.neo.org.tr/nobetci-eczaneler" },
  { slug: "ordu",    url: "https://ordueczaciodasi.org.tr/nobetci-eczaneler/" },
];

function extract(html, keyword, windowSize = 400) {
  const idx = html.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx < 0) return null;
  return html.slice(Math.max(0, idx - 50), idx + windowSize);
}

for (const t of TARGETS) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`[${t.slug.toUpperCase()}] ${t.url}`);
  try {
    const fetched = await fetchResource(t.url);
    const html = fetched.html ?? "";
    console.log(`  HTTP: ${fetched.status}  Size: ${html.length}`);

    // AJAX / API ipuçları
    const ajaxPatterns = [
      /getPharmacies/i, /nobetci.*ajax/i, /ajax.*nobetci/i,
      /api\/nobetci/i, /data-url/i, /fetch\(/i, /XMLHttpRequest/i,
      /wp-json/i, /\/api\//i,
    ];
    const scriptBlock = (html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) ?? []).join("\n");
    for (const p of ajaxPatterns) {
      if (p.test(html) || p.test(scriptBlock)) {
        const m = html.match(p) ?? scriptBlock.match(p);
        console.log(`  AJAX hint [${p}]: found`);
      }
    }

    // URL pattern arama (getPharmacies, api, json vb.)
    const urlPat = /https?:\/\/[^\s"'<>]+(?:nobetci|eczane|pharmacy|api|json)[^\s"'<>]*/gi;
    const foundUrls = [...new Set((html.match(urlPat) ?? []).slice(0, 10))];
    if (foundUrls.length) console.log(`  URLs found: ${foundUrls.join(", ")}`);

    // iframe?
    const iframes = html.match(/<iframe[^>]+>/gi) ?? [];
    if (iframes.length) console.log(`  iframes: ${iframes.map(f => f.slice(0,120)).join(" | ")}`);

    // JSON-LD / data attributes
    const jsonld = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonld) console.log(`  JSON-LD: ${jsonld[1].slice(0, 200)}`);

    // Eczane kelimesi geçen satırlar
    const lines = html.split("\n").filter(l => /eczane/i.test(l));
    console.log(`  Lines with 'eczane': ${lines.length}`);
    lines.slice(0, 5).forEach(l => console.log(`    ${l.trim().slice(0, 120)}`));

    // <ul>/<li> yapıları
    const ulBlocks = html.match(/<ul[^>]*>[\s\S]*?<\/ul>/gi) ?? [];
    const eczaneUls = ulBlocks.filter(b => /eczane/i.test(b));
    console.log(`  UL blocks total: ${ulBlocks.length}, with 'eczane': ${eczaneUls.length}`);
    if (eczaneUls.length > 0) {
      console.log(`  First eczane UL (500 chars):\n${eczaneUls[0].slice(0, 500)}`);
    }

    // <div> içinde eczane
    const eczaneDivSnippet = extract(html, "eczane", 800);
    if (eczaneDivSnippet) {
      console.log(`  Snippet near 'eczane':\n${eczaneDivSnippet.replace(/\s+/g," ").slice(0,600)}`);
    }

  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
  }
}
