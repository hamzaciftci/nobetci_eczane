import { fetchResource } from "../api/_lib/ingest/fetchLayer.js";

// ── Antalya: bolgeId değerlerini bul ──────────────────────────────────────
console.log("═══ ANTALYA: bolgeId aramak ═══");
{
  const f = await fetchResource("https://www.antalyaeo.org.tr/tr/nobetci-eczaneler");
  const html = f.html ?? "";
  // JS içinde bolge veya bolgeId
  const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  const bolgeScripts = scripts.filter(s => /bolge/i.test(s));
  console.log(`Scripts with bolge: ${bolgeScripts.length}`);
  bolgeScripts.forEach(s => console.log(s.slice(0, 600)));

  // data-bolge-id veya data-id
  const dataAttrs = html.match(/(?:bolge|bölge)[^'"]{0,20}["']:?\s*\d+/gi) ?? [];
  console.log("bolge values:", dataAttrs.slice(0,10));

  // Select/option elements
  const selects = html.match(/<select[^>]*>([\s\S]*?)<\/select>/gi) ?? [];
  selects.forEach(s => {
    if (/bolge|eczane/i.test(s)) console.log("SELECT:", s.slice(0, 400));
  });

  // bolgeId veya BolgeId pattern
  const bolgeIds = html.match(/(?:bolgeId|BolgeId|bolge_id)[^;]{0,100}/gi) ?? [];
  console.log("bolgeId patterns:", bolgeIds.slice(0,5));

  // POST çağrısı kodunu göster
  const postIdx = html.indexOf("/tr/eczane/getir");
  if (postIdx >= 0) {
    console.log("getir context:", html.slice(Math.max(0,postIdx-500), postIdx+500));
  }
}

// ── Aydın: gerçek içerik araştır ──────────────────────────────────────────
console.log("\n═══ AYDIN: içerik araştır ═══");
{
  const f = await fetchResource("https://www.aydineczaciodasi.org.tr/nobetci-4");
  const html = f.html ?? "";

  // TeknoEcza benzeri: <a title="Nöbetçi Eczane">
  const nobetciA = html.match(/<a[^>]*title="Nöbetçi Eczane"[^>]*>([^<]+)<\/a>/gi) ?? [];
  console.log(`a[title=Nöbetçi Eczane]: ${nobetciA.length}`);
  nobetciA.forEach(m => console.log("  ", m));

  // marquee/scroll içeriği
  const marquee = html.match(/<marquee[^>]*>([\s\S]*?)<\/marquee>/gi) ?? [];
  console.log(`Marquee blocks: ${marquee.length}`);
  marquee.forEach(m => console.log(m.slice(0,400)));

  // Eczane adı geçen divler
  const divEczane = html.match(/<div[^>]*>((?:[^<]|<(?!div))*eczane(?:[^<]|<(?!\/div))*)<\/div>/gi) ?? [];
  console.log(`div with eczane (first 3):`);
  divEczane.slice(0,3).forEach(d => console.log("  ", d.trim().slice(0,200)));

  // Sayfa body başlangıcı
  const mainContent = html.match(/id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section|main)>/i);
  if (mainContent) console.log("Main content:", mainContent[1].slice(0,500));

  // Tüm sayfada ECZANESİ kelimesi geçen kısımlar
  const eczIdxAll = [];
  let idx = 0;
  while ((idx = html.indexOf("ECZANESİ", idx)) >= 0) {
    eczIdxAll.push(idx);
    idx++;
  }
  console.log(`"ECZANESİ" occurrences: ${eczIdxAll.length}`);
  eczIdxAll.slice(0, 5).forEach(i => {
    console.log(`  @${i}: ${html.slice(Math.max(0,i-60),i+80).replace(/\s+/g," ")}`);
  });
}

// ── Ordu: tüm list/* URL'lerini test et ──────────────────────────────────
console.log("\n═══ ORDU: eczanesistemi.net list URL'leri ═══");
const orduListIds = [701, 702, 703, 704];
for (const id of orduListIds) {
  try {
    const f = await fetchResource(`https://ordu.eczanesistemi.net/list/${id}`);
    const html = f.html ?? "";
    // Eczane adları - Google Maps link format
    const eczaneLinks = html.match(/style="font-weight:bold[^>]*>([^<]+)<\/a>/gi) ?? [];
    console.log(`  list/${id}: HTTP ${f.status}, size ${html.length}, eczane links: ${eczaneLinks.length}`);
    eczaneLinks.slice(0,3).forEach(l => {
      const m = l.match(/>([^<]+)<\/a>/);
      if (m) console.log(`    - ${m[1].trim()}`);
    });
  } catch(e) { console.log(`  list/${id} error: ${e.message}`); }
}
