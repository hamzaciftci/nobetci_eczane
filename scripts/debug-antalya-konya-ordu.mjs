import { fetchResource } from "../api/_lib/ingest/fetchLayer.js";

// ── Antalya: nöbetçi liste nerede? ────────────────────────────────────────
console.log("═══ ANTALYA: nöbetçi liste bölümü ═══");
{
  const f = await fetchResource("https://www.antalyaeo.org.tr/tr/nobetci-eczaneler");
  const html = f.html ?? "";

  // Tüm script bloklarını göster (içerik aramak için)
  const allScripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  console.log(`Total scripts: ${allScripts.length}`);

  // nobetci, pharmacy, duty kelimesi içeren scriptler
  const nobetciScripts = allScripts.filter(s =>
    /nobetci|nöbet|pharmacy|duty|list|tarih/i.test(s)
  );
  console.log(`Scripts with nöbet/pharmacy: ${nobetciScripts.length}`);
  nobetciScripts.forEach(s => console.log("--- script ---\n", s.slice(0, 800)));

  // Nöbetçi pharmacy HTML bölümü - başka kalıplar
  const patterns = [
    /<table[^>]*class="[^"]*nobetci[^"]*"/gi,
    /<div[^>]*id="[^"]*nobetci[^"]*"/gi,
    /<div[^>]*class="[^"]*nobetci[^"]*"/gi,
    /data-src="[^"]*nobetci[^"]*"/gi,
    /nobetci-eczaneler-liste/gi,
    /NobetciList/gi,
    /getAllNobetci/gi,
  ];
  for (const p of patterns) {
    const m = html.match(p) ?? [];
    if (m.length) console.log(`Pattern [${p.source.slice(0,40)}]: ${m.length} hits → ${m[0].slice(0,100)}`);
  }

  // HTML'de tbody veya tr içinde eczane geçen kısım
  const trWithEczane = html.match(/<tr[^>]*>(?:[^<]|<(?!\/tr>))*eczane(?:[^<]|<(?!\/tr>))*<\/tr>/gi) ?? [];
  console.log(`TR with eczane: ${trWithEczane.length}`);
  trWithEczane.slice(0,3).forEach(t => console.log("  TR:", t.slice(0,200)));

  // Antalya'da herhangi bir eczane adı var mı?
  const eczaneAdlari = html.match(/[A-ZÇĞÖŞÜİ\s]{6,30}\s+ECZANESİ/g) ?? [];
  console.log(`ECZANESİ patterns: ${eczaneAdlari.length}`);
  eczaneAdlari.slice(0,5).forEach(e => console.log("  -", e));

  // Son 3000 karakter (sayfa sonu genellikle veri içerir)
  console.log("HTML end:", html.slice(-2000).replace(/\s+/g," ").slice(-1000));
}

// ── Konya: tablo yapısını incele ─────────────────────────────────────────
console.log("\n═══ KONYA konyanobetcieczaneleri.com: tablo yapısı ═══");
{
  const f = await fetchResource("http://www.konyanobetcieczaneleri.com");
  const html = f.html ?? "";
  // İlk veri tablosunu göster
  const tables = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi) ?? [];
  console.log(`Tables: ${tables.length}`);
  // İlk data table (baslik_eczane içereni)
  const dataTable = tables.find(t => /baslik_eczane|Eczane/i.test(t));
  if (dataTable) {
    console.log("Data table (first 1500):", dataTable.slice(0, 1500));
  }
  // Tüm TD içeriği - eczane adları
  const tdTexts = html.match(/<td[^>]*>([^<]+)<\/td>/gi) ?? [];
  console.log(`\nTD count: ${tdTexts.length}`);
  // Eczane adı gibi görünenleri filtrele
  const eczaneTds = tdTexts.filter(td => /ECZ|eczane/i.test(td) && td.length > 20);
  console.log(`Eczane TDs (first 10):`);
  eczaneTds.slice(0, 10).forEach(td => console.log("  ", td.replace(/<[^>]+>/g,"").trim().slice(0,80)));
}

// ── Ordu: tüm list ID'lerini tara ────────────────────────────────────────
console.log("\n═══ ORDU: tüm list ID taraması ═══");
{
  // Ordu sayfasından iframe ID'lerini çek
  const f = await fetchResource("https://ordueczaciodasi.org.tr/nobetci-eczaneler/");
  const html = f.html ?? "";
  const iframeIds = [...new Set(
    (html.match(/eczanesistemi\.net\/list\/(\d+)/gi) ?? [])
      .map(m => parseInt(m.match(/\/(\d+)$/)[1]))
      .sort((a,b) => a-b)
  )];
  console.log(`Unique eczanesistemi list IDs: ${iframeIds.join(", ")}`);

  // Her ID için fetch et
  let total = 0;
  const allPharmacies = [];
  for (const id of iframeIds) {
    try {
      const r = await fetchResource(`https://ordu.eczanesistemi.net/list/${id}`);
      const rhtml = r.html ?? "";
      // Eczane adları
      const links = rhtml.match(/<a href="https:\/\/maps\.google\.com[^"]*"[^>]*style="font-weight:bold[^"]*"[^>]*>([^<]+)<\/a>/gi) ?? [];
      const names = links.map(l => {
        const m = l.match(/>([^<]+)<\/a>/);
        return m ? m[1].replace(/^(?:GÜNDÜZ-GECE|GECE|GÜNDÜZ)\s*[:\s]+/i, "").trim() : null;
      }).filter(Boolean);
      if (names.length > 0) {
        console.log(`  list/${id}: ${names.length} → ${names.join(", ")}`);
        allPharmacies.push(...names);
        total += names.length;
      }
    } catch(e) { /* skip */ }
  }
  console.log(`\nToplam Ordu eczane: ${total}`);
  console.log("Tümü:", allPharmacies.join(", "));
}
