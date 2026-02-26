#!/usr/bin/env node
/**
 * verify-all.mjs
 *
 * Her Türkiye ili için API verisini canlı eczacı odası kaynağıyla karşılaştırır.
 *
 * Kullanım:
 *   node scripts/verify-all.mjs                      # 81 il
 *   node scripts/verify-all.mjs adana izmir          # seçili iller
 *   node scripts/verify-all.mjs --concurrency=5      # paralel sayısı
 *   node scripts/verify-all.mjs --date=2026-02-26    # tarih etiketi (raporlama)
 *   node scripts/verify-all.mjs --fail-fast          # ilk FAIL'de dur
 *   node scripts/verify-all.mjs --json-only          # sadece JSON rapor (stdout yok)
 *   API_BASE_URL=https://... node scripts/verify-all.mjs  # canlı API çağrısı
 *
 * Çıkış kodu:
 *   0 – FAIL yok (PASS, NO_DATA, ERROR sonuçları olabilir)
 *   1 – en az bir FAIL var
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { scrapeProvince } from "./lib/scrapeProvince.mjs";
import { diffLists, normalizeName, findClosestMatch, normalizeList } from "./lib/normalize.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));

// ─── CLI args ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt  = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) ?? "").split("=")[1] ?? null;

const CONCURRENCY = parseInt(opt("concurrency") ?? "3", 10);
const TARGET_DATE  = opt("date");           // etiketi / raporlama için
const FAIL_FAST    = flag("fail-fast");
const JSON_ONLY    = flag("json-only");
const PROVINCE_ARGS = argv.filter((a) => !a.startsWith("--"));

const API_BASE_URL = (process.env.API_BASE_URL ?? "").trim();

// ─── Bootstrap ────────────────────────────────────────────────────────────

const envPath = join(__dir, "../.env.local");
try {
  const raw = readFileSync(envPath, "utf8");
  const vars = Object.fromEntries(
    raw
      .split("\n")
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
      .filter(([k]) => k)
  );
  Object.assign(process.env, vars);
} catch {
  // .env.local yoksa çevre değişkenlerine bak
}

const dbUrl = (process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL ?? "").trim();
if (!dbUrl) {
  console.error("HATA: DATABASE_URL bulunamadı (.env.local veya çevre değişkeni)");
  process.exit(1);
}
const sql = neon(dbUrl);

// ─── DB helpers ───────────────────────────────────────────────────────────

/** Tüm aktif endpoint'leri olan illeri döndürür */
async function getProvinces() {
  return sql`
    SELECT
      p.slug,
      p.name,
      se.endpoint_url,
      se.parser_key,
      se.format
    FROM provinces p
    JOIN sources s           ON s.province_id = p.id
    JOIN source_endpoints se ON se.source_id = s.id
                             AND se.is_primary = true
                             AND se.enabled    = true
    ORDER BY p.slug
  `;
}

/**
 * Bir il için API/DB verisi alır.
 * API_BASE_URL set edilmişse canlı endpoint çağrılır, yoksa VIEW sorgulanır.
 */
async function getApiPharmacies(ilSlug) {
  // Mod 1: Canlı API
  if (API_BASE_URL) {
    const url = `${API_BASE_URL}/api/il/${encodeURIComponent(ilSlug)}/nobetci`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} → ${url}`);
    const body = await resp.json();
    const pharmacies = body.data ?? body.pharmacies ?? [];
    return pharmacies.map((p) => p.eczane_adi ?? p.name ?? "").filter(Boolean);
  }

  // Mod 2: Doğrudan DB (api_active_duty VIEW — resolve_active_duty_date() kullanır)
  const rows = await sql`
    SELECT eczane_adi
    FROM api_active_duty
    WHERE il_slug = ${ilSlug}
  `;
  return rows.map((r) => r.eczane_adi);
}

// ─── Test fonksiyonu ─────────────────────────────────────────────────────

async function verifyProvince(province) {
  const { slug, name, endpoint_url, parser_key, format } = province;
  const started = Date.now();

  let apiNames  = [];
  let liveNames = [];
  let apiError  = null;
  let liveError = null;
  let httpStatus = null;

  // 1. API / DB verisi
  try {
    apiNames = await getApiPharmacies(slug);
  } catch (err) {
    apiError = err.message;
  }

  // 2. Canlı kaynak scrape
  const scraped = await scrapeProvince({ endpoint_url, parser_key, format }, slug);
  liveNames  = scraped.names;
  liveError  = scraped.error;
  httpStatus = scraped.httpStatus;

  // 3. Karşılaştırma
  const { missing, extra, matched } = diffLists(apiNames, liveNames);

  // Fuzzy öneriler (yakın ama eşleşmeyen isimler)
  const apiSet  = new Set(normalizeList(apiNames));
  const liveSet = new Set(normalizeList(liveNames));
  const suggestions = missing
    .map((m) => ({ name: m, closest: findClosestMatch(m, apiSet) }))
    .filter((s) => s.closest !== null);

  // 4. Sonuç kararı
  let result;
  if (apiError || liveError) {
    result = "ERROR";
  } else if (liveNames.length === 0) {
    result = "NO_SOURCE_DATA";
  } else if (apiNames.length === 0) {
    result = "NO_API_DATA";
  } else if (missing.length === 0 && extra.length === 0) {
    result = "PASS";
  } else {
    result = "FAIL";
  }

  return {
    slug,
    name,
    result,
    api_count:  apiNames.length,
    live_count: liveNames.length,
    matched,
    missing,
    extra,
    suggestions,
    http_status:  httpStatus,
    api_error:    apiError,
    live_error:   liveError,
    elapsed_ms:   Date.now() - started,
  };
}

// ─── Batch runner ─────────────────────────────────────────────────────────

async function runBatched(items, fn, concurrency, onResult) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch   = items.slice(i, i + concurrency);
    const partial = await Promise.all(batch.map(fn));
    for (const r of partial) {
      results.push(r);
      if (onResult) onResult(r, results.length, items.length);
    }
    if (i + concurrency < items.length) {
      await new Promise((res) => setTimeout(res, 400)); // rate-limit
    }
  }
  return results;
}

// ─── Çıktı formatları ─────────────────────────────────────────────────────

const ICON = { PASS: "✓", FAIL: "✗", ERROR: "⚠", NO_SOURCE_DATA: "—", NO_API_DATA: "?" };
const COLOR = {
  PASS:           "\x1b[32m",   // yeşil
  FAIL:           "\x1b[31m",   // kırmızı
  ERROR:          "\x1b[33m",   // sarı
  NO_SOURCE_DATA: "\x1b[90m",   // gri
  NO_API_DATA:    "\x1b[33m",   // sarı
  RESET:          "\x1b[0m",
};

function colorize(result, text) {
  return `${COLOR[result] ?? ""}${text}${COLOR.RESET}`;
}

/** Tek il sonucunu ekrana yazdırır */
function printResult(r, idx, total) {
  if (JSON_ONLY) return;
  const icon  = ICON[r.result] ?? "?";
  const color = COLOR[r.result] ?? "";

  console.log(`\n${color}=== [${idx}/${total}] ${r.name.toUpperCase()} (${r.slug}) ===${COLOR.RESET}`);
  console.log(`  API Sayısı   : ${r.api_count}`);
  console.log(`  Kaynak Sayısı: ${r.live_count}`);
  console.log(`  Eşleşen      : ${r.matched}`);

  if (r.missing.length > 0) {
    console.log(`  ${colorize("FAIL","Eksik (Kaynakta var, API'de yok)")}:`);
    r.missing.forEach((m) => {
      const sug = r.suggestions.find((s) => s.name === m);
      const hint = sug ? ` (yakın: "${sug.closest}"?)` : "";
      console.log(`    - ${m}${hint}`);
    });
  }
  if (r.extra.length > 0) {
    console.log(`  ${colorize("ERROR","Fazla (API'de var, Kaynakta yok)")}:`);
    r.extra.forEach((e) => console.log(`    + ${e}`));
  }
  if (r.api_error)  console.log(`  API Hatası  : ${r.api_error}`);
  if (r.live_error) console.log(`  Kaynak Hata : ${r.live_error}`);

  const label = `${icon} ${r.result}  (${r.elapsed_ms}ms)`;
  console.log(`  Sonuç        : ${colorize(r.result, label)}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date();
  const dateLabel = TARGET_DATE ?? now.toLocaleDateString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  if (!JSON_ONLY) {
    console.log(`\n${"═".repeat(56)}`);
    console.log(`  NÖBETÇİ ECZANE DOĞRULAMA`);
    console.log(`  Tarih      : ${dateLabel}`);
    console.log(`  Mod        : ${API_BASE_URL ? `API (${API_BASE_URL})` : "DB (api_active_duty VIEW)"}`);
    console.log(`  Concurrency: ${CONCURRENCY}`);
    console.log(`  Başlıyor   : ${now.toLocaleTimeString("tr-TR")}`);
    console.log(`${"═".repeat(56)}`);
  }

  // Province listesini yükle
  let provinces = await getProvinces();

  if (PROVINCE_ARGS.length > 0) {
    provinces = provinces.filter((p) => PROVINCE_ARGS.includes(p.slug));
    if (!provinces.length) {
      console.error("HATA: Belirtilen iller DB'de bulunamadı:", PROVINCE_ARGS.join(", "));
      process.exit(1);
    }
  }

  if (!JSON_ONLY) {
    console.log(`\nTest edilecek il: ${provinces.length}`);
  }

  let shouldStop = false;

  const results = await runBatched(
    provinces,
    verifyProvince,
    CONCURRENCY,
    (r, idx, total) => {
      printResult(r, idx, total);
      if (FAIL_FAST && r.result === "FAIL") {
        shouldStop = true;
      }
    }
  );

  // ─── Özet ─────────────────────────────────────────────────────────────
  const counts = {
    PASS:           results.filter((r) => r.result === "PASS").length,
    FAIL:           results.filter((r) => r.result === "FAIL").length,
    ERROR:          results.filter((r) => r.result === "ERROR").length,
    NO_SOURCE_DATA: results.filter((r) => r.result === "NO_SOURCE_DATA").length,
    NO_API_DATA:    results.filter((r) => r.result === "NO_API_DATA").length,
  };

  if (!JSON_ONLY) {
    console.log(`\n${"═".repeat(56)}`);
    console.log(`ÖZET — ${dateLabel}`);
    console.log(`${"═".repeat(56)}`);
    console.log(`  Toplam           : ${results.length}`);
    console.log(`  ${colorize("PASS",  `✓ PASS           : ${counts.PASS}`)}`);
    console.log(`  ${colorize("FAIL",  `✗ FAIL           : ${counts.FAIL}`)}`);
    console.log(`  ${colorize("ERROR", `⚠ ERROR          : ${counts.ERROR}`)}`);
    console.log(`    — Kaynak yok   : ${counts.NO_SOURCE_DATA}`);
    console.log(`    ? API yok      : ${counts.NO_API_DATA}`);

    if (counts.FAIL > 0) {
      console.log(`\n  Başarısız iller:`);
      results
        .filter((r) => r.result === "FAIL")
        .forEach((r) => {
          console.log(
            `    ✗ ${r.slug.padEnd(16)} missing=${r.missing.length}  extra=${r.extra.length}`
          );
        });
    }
    if (counts.ERROR > 0) {
      console.log(`\n  Hata iller:`);
      results
        .filter((r) => r.result === "ERROR")
        .forEach((r) => {
          const err = r.api_error ?? r.live_error ?? "?";
          console.log(`    ⚠ ${r.slug.padEnd(16)} ${err.slice(0, 60)}`);
        });
    }
  }

  // ─── JSON rapor ────────────────────────────────────────────────────────
  const dateStr   = now.toISOString().slice(0, 10).replace(/-/g, "");
  const reportPath = join(__dir, `../verify-report-${dateStr}.json`);

  const report = {
    generated_at: now.toISOString(),
    date_label:   dateLabel,
    mode:         API_BASE_URL ? "api" : "db",
    api_base_url: API_BASE_URL || null,
    total:        results.length,
    summary:      counts,
    results: results.map((r) => ({
      slug:        r.slug,
      name:        r.name,
      result:      r.result,
      api_count:   r.api_count,
      live_count:  r.live_count,
      matched:     r.matched,
      missing:     r.missing,
      extra:       r.extra,
      suggestions: r.suggestions,
      http_status: r.http_status,
      errors:      [r.api_error, r.live_error].filter(Boolean),
      elapsed_ms:  r.elapsed_ms,
    })),
  };

  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  if (!JSON_ONLY) {
    console.log(`\n  Rapor: ${reportPath}`);
    console.log(`${"═".repeat(56)}\n`);
  } else {
    // --json-only: raporu stdout'a bas
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  }

  process.exit(counts.FAIL > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
