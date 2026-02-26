/**
 * Özel kaynak araştırması:
 * 1. Antalya: /tr/eczane/getir AJAX
 * 2. Niğde/Aydın: TeknoEcza HTML yapısı
 * 3. Konya: konyanobetcieczaneleri.com
 * 4. Ordu: eczanesistemi.net/list/701
 */
import { fetchResource } from "../api/_lib/ingest/fetchLayer.js";

const BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json, text/html, */*",
};

async function post(url, body, headers = {}) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...BASE_HEADERS, ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  return { status: resp.status, text: await resp.text() };
}

// ── 1. Antalya AJAX ────────────────────────────────────────────────────────
console.log("\n═══ ANTALYA /tr/eczane/getir ═══");
try {
  // Önce GET dene
  const r1 = await post("https://www.antalyaeo.org.tr/tr/eczane/getir", {});
  console.log(`POST {}: ${r1.status}  ${r1.text.slice(0, 300)}`);
} catch(e) { console.log("POST err:", e.message); }

try {
  // Tarihli POST dene
  const today = new Date().toISOString().slice(0,10);
  const r2 = await post("https://www.antalyaeo.org.tr/tr/eczane/getir", { tarih: today });
  console.log(`POST {tarih}: ${r2.status}  ${r2.text.slice(0, 300)}`);
} catch(e) { console.log("POST tarih err:", e.message); }

try {
  // Form-encoded POST
  const resp = await fetch("https://www.antalyaeo.org.tr/tr/eczane/getir", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...BASE_HEADERS },
    body: "",
    signal: AbortSignal.timeout(15_000),
  });
  const text = await resp.text();
  console.log(`Form POST: ${resp.status}  ${text.slice(0, 400)}`);
} catch(e) { console.log("Form POST err:", e.message); }

// ── 2. Niğde TeknoEcza ────────────────────────────────────────────────────
console.log("\n═══ NİĞDE HTML ═══");
try {
  const f = await fetchResource("https://www.neo.org.tr/nobetci-eczaneler");
  const html = f.html ?? "";
  // Başlık tag'leri ara
  const titleMatch = html.match(/title="Nöbetçi Eczane">([^<]+)</gi) ?? [];
  console.log(`title="Nöbetçi Eczane" matches: ${titleMatch.length}`);
  titleMatch.forEach(m => console.log("  ", m));

  // <a href="nobetci-eczaneler" içerenleri bul
  const linkMatches = html.match(/<a[^>]*href="nobetci-eczaneler"[^>]*>([^<]+)<\/a>/gi) ?? [];
  console.log(`nobetci-eczaneler link matches: ${linkMatches.length}`);
  linkMatches.forEach(m => console.log("  ", m));

  // Daha geniş: Eczane adı yazı stilleri
  const styledAnchors = html.match(/<a style="[^"]*"[^>]*title="Nöbetçi Eczane"[^>]*>([^<]+)<\/a>/gi) ?? [];
  console.log(`Styled anchor matches: ${styledAnchors.length}`);
  styledAnchors.forEach(m => console.log("  ", m));

  // Tüm <a title="Nöbetçi Eczane">
  const allNobetci = html.match(/<a[^>]*title="Nöbetçi Eczane[^"]*"[^>]*>([^<]+)<\/a>/gi) ?? [];
  console.log(`All a[title*=Nöbetçi] matches: ${allNobetci.length}`);
  allNobetci.forEach(m => console.log("  ", m));

  // Data-containing div yapısı
  const divMatches = html.match(/<div[^>]*class="[^"]*(?:nobetci|eczane)[^"]*"[^>]*>/gi) ?? [];
  console.log(`Div with nobetci/eczane class: ${divMatches.length}`);

  // Tüm sayfa content snippet (ilk 2000)
  const idx = html.indexOf("NAZLI");
  if (idx >= 0) {
    console.log(`NAZLI context: ${html.slice(Math.max(0,idx-200), idx+600)}`);
  }
} catch(e) { console.log("Niğde err:", e.message); }

// ── 3. Konya ──────────────────────────────────────────────────────────────
console.log("\n═══ KONYA konyanobetcieczaneleri.com ═══");
try {
  const f = await fetchResource("http://www.konyanobetcieczaneleri.com");
  const html = f.html ?? "";
  console.log(`HTTP: ${f.status}  Size: ${html.length}`);
  // Tablo var mı?
  const tables = (html.match(/<table/gi) ?? []).length;
  console.log(`Tables: ${tables}`);
  // Eczane kelimeleri
  const eczaneLines = html.split("\n").filter(l => /eczane/i.test(l)).slice(0,5);
  eczaneLines.forEach(l => console.log(" ", l.trim().slice(0,120)));
  console.log("Body:", html.slice(0, 1000).replace(/\s+/g," "));
} catch(e) { console.log("Konya konyanobetci err:", e.message); }

// ── 4. Ordu eczanesistemi.net ─────────────────────────────────────────────
console.log("\n═══ ORDU eczanesistemi.net/list/701 ═══");
try {
  const f = await fetchResource("https://ordu.eczanesistemi.net/list/701");
  const html = f.html ?? "";
  console.log(`HTTP: ${f.status}  Size: ${html.length}`);
  const tables = (html.match(/<table/gi) ?? []).length;
  const trs = (html.match(/<tr/gi) ?? []).length;
  console.log(`Tables: ${tables}, TRs: ${trs}`);
  const eczaneLines = html.split("\n").filter(l => /eczane/i.test(l)).slice(0, 8);
  eczaneLines.forEach(l => console.log("  ", l.trim().slice(0,120)));
  // İlk içerik snippet
  const bodyStart = html.indexOf("<body");
  console.log("Body:", html.slice(bodyStart, bodyStart+1200).replace(/\s+/g," ").slice(0,800));
} catch(e) { console.log("Ordu err:", e.message); }

// ── 5. Aydın ─────────────────────────────────────────────────────────────
console.log("\n═══ AYDIN eczane listesi ═══");
try {
  const f = await fetchResource("https://www.aydineczaciodasi.org.tr/nobetci-4");
  const html = f.html ?? "";
  // Ana içerik alanı
  const mainMatch = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  // <div id="content"> veya benzer
  const idx = html.indexOf("ECZANE");
  if (idx >= 0) {
    console.log(`First ECZANE context: ${html.slice(Math.max(0,idx-300),idx+600).replace(/\s+/g," ")}`);
  }
  // Sayfa JS'te API var mı?
  const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  const apiScripts = scriptTags.filter(s => /nobetci|eczane|getir|api/i.test(s));
  console.log(`API-related scripts: ${apiScripts.length}`);
  apiScripts.slice(0,2).forEach(s => console.log("  ", s.slice(0,300)));
} catch(e) { console.log("Aydın err:", e.message); }
