import { fetchResource } from "../api/_lib/ingest/fetchLayer.js";

// ── Antalya: nobetciler div yapısı ─────────────────────────────────────────
console.log("═══ ANTALYA: .nobetciler div yapısı ═══");
{
  const f = await fetchResource("https://www.antalyaeo.org.tr/tr/nobetci-eczaneler");
  const html = f.html ?? "";

  // <div class="nobetciler"> bloğunu çek
  const idx = html.indexOf('class="nobetciler"');
  if (idx >= 0) {
    const snippet = html.slice(idx, idx + 2000);
    console.log("First nobetciler block:\n", snippet);
  }

  // Tüm nobetciler div'lerini bul
  const blocks = html.match(/<div[^>]*class="nobetciler"[^>]*>([\s\S]*?)<\/div>/gi) ?? [];
  console.log(`Total nobetciler divs: ${blocks.length}`);
  if (blocks.length > 0) {
    // İçerisindeki eczane adlarını çek
    blocks.slice(0, 3).forEach((b, i) => {
      const text = b.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      console.log(`  Block ${i}: ${text.slice(0, 200)}`);
    });
  }

  // Daha geniş arama - h3, h4, p, span içinde eczane adı
  const eczaneContexts = [];
  let pos = 0;
  while (true) {
    const nextIdx = html.indexOf("ECZANESİ", pos);
    if (nextIdx < 0) break;
    eczaneContexts.push(html.slice(Math.max(0, nextIdx - 150), nextIdx + 100).replace(/\s+/g," "));
    pos = nextIdx + 1;
  }
  console.log(`\nECZANESİ contexts (${eczaneContexts.length}):`);
  eczaneContexts.slice(0, 5).forEach(c => console.log("  ", c));
}

// ── Konya: tüm TD içerikleri ─────────────────────────────────────────────
console.log("\n═══ KONYA: tüm satır içerikleri ═══");
{
  const f = await fetchResource("http://www.konyanobetcieczaneleri.com");
  const html = f.html ?? "";

  // Tüm TR satırlarını parse et - her TR'nin tüm TD içerikleri
  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];
  console.log(`Total TRs: ${rows.length}`);

  // Her satırın text içeriğini göster (boş olmayanlar)
  const dataRows = rows.map(r => {
    const tds = r.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) ?? [];
    return tds.map(td => td.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).filter(t => t.length > 1);
  }).filter(r => r.length > 0 && r.some(t => t.length > 3));

  console.log(`Data rows with content: ${dataRows.length}`);
  dataRows.slice(0, 20).forEach(r => console.log("  TR:", r.join(" | ").slice(0, 120)));
}
