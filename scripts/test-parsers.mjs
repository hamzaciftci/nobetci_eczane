/**
 * Yeni parserleri canlı kaynaklarla test eder.
 */
import { fetchResource } from "../api/_lib/ingest/fetchLayer.js";
import { parseHtmlPharmacies } from "../api/_lib/ingest/parserLayer.js";

const TESTS = [
  { slug: "antalya", url: "https://www.antalyaeo.org.tr/tr/nobetci-eczaneler", parser: "generic_auto_v1" },
  { slug: "nigde",   url: "https://www.neo.org.tr/nobetci-eczaneler",           parser: "teknoecza_v1" },
  { slug: "aydin",   url: "https://www.aydineczaciodasi.org.tr/nobetci-4",      parser: "teknoecza_v2" },
  { slug: "konya",   url: "http://www.konyanobetcieczaneleri.com",              parser: "generic_auto_v1" },
];

for (const t of TESTS) {
  console.log(`\n── ${t.slug.toUpperCase()} (${t.parser}) ──`);
  try {
    const f = await fetchResource(t.url);
    const rows = parseHtmlPharmacies(f.html ?? "", t.parser);
    console.log(`  Rows: ${rows.length}`);
    rows.slice(0, 5).forEach(r => console.log(`  - ${r.name} | ${r.district || "(no district)"}`));
    if (rows.length === 0) console.log("  ❌ FAIL: no rows");
    else console.log("  ✓ PASS");
  } catch(e) {
    console.log(`  ERROR: ${e.message}`);
  }
}
