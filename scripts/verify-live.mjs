#!/usr/bin/env node
/**
 * verify-live.mjs
 *
 * Canlı eczacı odası kaynağı ile bizim API'nin verdiği listeyi karşılaştırır.
 *
 * Kullanım:
 *   node scripts/verify-live.mjs                         # Osmaniye (default)
 *   node scripts/verify-live.mjs --all                   # Tüm 81 il
 *   node scripts/verify-live.mjs ankara izmir            # Seçili iller
 *   node scripts/verify-live.mjs --all --concurrency=5   # Paralel sayısı
 *   node scripts/verify-live.mjs --all --fix             # FAIL olanlara ingest uygula
 *   API_BASE=https://... node scripts/verify-live.mjs --all
 *
 * Çıkış kodu:
 *   0 – Tüm iller PASS (veya SOURCE_ERROR / NO_SOURCE_DATA sayılmaz)
 *   1 – En az bir il FAIL
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { scrapeProvince } from "./lib/scrapeProvince.mjs";
import { classifyDiff } from "./lib/normalize.mjs";
import { ingestProvince } from "../api/_lib/ingest.js";
import { createHash } from "crypto";

const __dir = dirname(fileURLToPath(import.meta.url));

// ─── .env.local yükle ─────────────────────────────────────────────────────
try {
  const raw = readFileSync(join(__dir, "../.env.local"), "utf8");
  for (const line of raw.split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local yoksa devam et */ }

// ─── Sabitler ─────────────────────────────────────────────────────────────
const API_BASE = (process.env.API_BASE || "https://www.bugunnobetcieczaneler.com").replace(/\/$/, "");
const DB_URL   = (process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "").trim();

// ─── CLI argümanları ───────────────────────────────────────────────────────
const argv        = process.argv.slice(2);
const flag        = (n) => argv.includes(`--${n}`);
const opt         = (n) => (argv.find((a) => a.startsWith(`--${n}=`)) ?? "").split("=")[1] ?? null;
const ALL_MODE    = flag("all");
const FIX_MODE    = flag("fix");
const CONCURRENCY = Math.max(1, parseInt(opt("concurrency") ?? "4", 10));
const VERBOSE     = flag("verbose") || !ALL_MODE; // tek il modunda verbose
const slugArgs    = argv.filter((a) => !a.startsWith("--"));

// ─── Yardımcılar ───────────────────────────────────────────────────────────
function md5(text) {
  return createHash("md5").update(text).digest("hex").slice(0, 8);
}
function ts() {
  return new Date().toLocaleTimeString("tr-TR", { hour12: false });
}
function pad(s, n) {
  return String(s).padEnd(n);
}

// ─── Pool: N paralel, sıralı batch ────────────────────────────────────────
async function runPool(tasks, concurrency, fn) {
  const results = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await fn(tasks[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ─── Tek il için karşılaştırma ─────────────────────────────────────────────
async function verifyOne(sql, ilSlug) {
  const started = Date.now();

  // 1. DB'den endpoint bilgisi
  const eps = await sql`
    SELECT se.endpoint_url, se.parser_key, se.format
    FROM source_endpoints se
    JOIN sources   s ON s.id = se.source_id
    JOIN provinces p ON p.id = s.province_id
    WHERE p.slug        = ${ilSlug}
      AND se.is_primary = true
      AND se.enabled    = true
    LIMIT 1
  `;

  if (!eps.length) {
    return { status: "NO_ENDPOINT", il: ilSlug, elapsed_ms: Date.now() - started };
  }

  const ep = eps[0];

  // 2. Canlı kaynaktan çek
  const scrapeResult = await scrapeProvince(ep, ilSlug);

  if (scrapeResult.error) {
    return { status: "SOURCE_ERROR", il: ilSlug, error: scrapeResult.error, elapsed_ms: Date.now() - started };
  }
  if (!scrapeResult.names.length) {
    return { status: "NO_SOURCE_DATA", il: ilSlug, elapsed_ms: Date.now() - started };
  }

  const liveNames = scrapeResult.names;
  const liveHash  = md5(liveNames.slice().sort().join("|"));

  // 3. API'den çek
  let apiData;
  try {
    const resp = await fetch(`${API_BASE}/api/il/${ilSlug}/nobetci`, {
      headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    apiData = await resp.json();
  } catch (err) {
    return { status: "API_ERROR", il: ilSlug, error: err.message, elapsed_ms: Date.now() - started };
  }

  const apiNames   = (apiData.data ?? []).map((p) => p.eczane_adi || p.name || "").filter(Boolean);
  const apiHash    = md5(apiNames.slice().sort().join("|"));
  const apiStatus  = apiData.status || "ok";
  const dutyDate   = apiData.duty_date || "(yok)";

  // 4. Diff
  const { missing, extra, mismatch, matched } = classifyDiff(apiNames, liveNames);
  const elapsed = Date.now() - started;

  if (missing.length === 0 && extra.length === 0 && mismatch.length === 0) {
    return { status: "PASS", il: ilSlug, matched, liveHash, apiHash, apiStatus, dutyDate, elapsed_ms: elapsed };
  }

  return {
    status: "FAIL",
    il: ilSlug,
    matched,
    missing,
    extra,
    mismatch,
    liveNames,
    apiNames,
    liveHash,
    apiHash,
    apiStatus,
    dutyDate,
    endpoint: ep.endpoint_url,
    elapsed_ms: elapsed,
  };
}

// ─── FAIL olan ili ingest ile düzelt ───────────────────────────────────────
async function fixProvince(sql, ilSlug) {
  console.log(`\n  🔧 [${ilSlug}] ingest başlatılıyor...`);
  try {
    const r = await ingestProvince(sql, ilSlug);
    if (r.upserted > 0) {
      console.log(`  ✅ [${ilSlug}] ingest başarılı: ${r.upserted}/${r.found} eczane yazıldı (${r.elapsed_ms}ms)`);
      return true;
    }
    console.log(`  ⚠️  [${ilSlug}] ingest tamamlandı ama 0 eczane yazıldı (status: ${r.status})`);
    return false;
  } catch (err) {
    console.log(`  ❌ [${ilSlug}] ingest hatası: ${err.message}`);
    return false;
  }
}

// ─── Ana akış ──────────────────────────────────────────────────────────────
async function main() {
  if (!DB_URL) {
    console.error("Hata: DATABASE_URL veya NEON_DATABASE_URL eksik.");
    process.exit(1);
  }

  const sql = neon(DB_URL);

  // Hedef iller listesi
  let targetSlugs;
  if (ALL_MODE) {
    const rows = await sql`
      SELECT DISTINCT p.slug
      FROM source_endpoints se
      JOIN sources   s ON s.id = se.source_id
      JOIN provinces p ON p.id = s.province_id
      WHERE se.is_primary = true AND se.enabled = true
      ORDER BY p.slug
    `;
    targetSlugs = rows.map((r) => r.slug);
  } else if (slugArgs.length) {
    targetSlugs = slugArgs;
  } else {
    targetSlugs = ["osmaniye"];
  }

  console.log(`\n${"═".repeat(64)}`);
  console.log(`  verify-live.mjs`);
  console.log(`  Zaman       : ${new Date().toLocaleString("tr-TR")}`);
  console.log(`  API         : ${API_BASE}`);
  console.log(`  İl sayısı   : ${targetSlugs.length}  (paralel: ${CONCURRENCY})`);
  if (FIX_MODE) console.log(`  Mod         : --fix (FAIL → otomatik ingest)`);
  console.log(`${"═".repeat(64)}`);

  // Verbose (tek il) modda detaylı çıktı
  if (VERBOSE && targetSlugs.length === 1) {
    const r = await verifyOne(sql, targetSlugs[0]);
    printVerbose(r);
    if (FIX_MODE && r.status === "FAIL") {
      await fixProvince(sql, r.il);
      console.log(`\n  Yeniden doğrulanıyor...`);
      const r2 = await verifyOne(sql, targetSlugs[0]);
      printVerbose(r2);
    }
    printSummary([r]);
    process.exit(r.status === "FAIL" ? 1 : 0);
  }

  // Çok-il modu: paralel, kompakt çıktı
  if (ALL_MODE || targetSlugs.length > 1) {
    console.log(`\n  ${pad("İL", 18)} ${pad("DURUM", 14)} ${pad("KAYNAK", 6)} ${pad("API", 6)} DutyDate`);
    console.log(`  ${"─".repeat(62)}`);
  }

  const results = await runPool(targetSlugs, CONCURRENCY, async (slug) => {
    const r = await verifyOne(sql, slug);
    printCompact(r);
    return r;
  });

  // --fix: FAIL olanları ingest et, sonra yeniden doğrula
  const failedSlugs = results.filter((r) => r.status === "FAIL").map((r) => r.il);
  if (FIX_MODE && failedSlugs.length > 0) {
    console.log(`\n${"─".repeat(64)}`);
    console.log(`  🔧 ${failedSlugs.length} il düzeltiliyor: ${failedSlugs.join(", ")}`);

    for (const slug of failedSlugs) {
      await fixProvince(sql, slug);
    }

    console.log(`\n  Düzeltilen iller yeniden doğrulanıyor...`);
    console.log(`\n  ${pad("İL", 18)} ${pad("DURUM", 14)} ${pad("KAYNAK", 6)} ${pad("API", 6)} DutyDate`);
    console.log(`  ${"─".repeat(62)}`);

    for (const slug of failedSlugs) {
      const r2 = await verifyOne(sql, slug);
      printCompact(r2);
      const idx = results.findIndex((r) => r.il === slug);
      if (idx >= 0) results[idx] = r2;
    }
  }

  printSummary(results);
  const hasFail = results.some((r) => r.status === "FAIL");
  process.exit(hasFail ? 1 : 0);
}

// ─── Çıktı fonksiyonları ───────────────────────────────────────────────────

function printVerbose(r) {
  console.log(`\n${("─").repeat(64)}`);
  console.log(`[${ts()}] ${r.il.toUpperCase()}`);
  if (r.status === "PASS") {
    console.log(`  ✅ PASS — ${r.matched} eczane eşleşti  (${r.elapsed_ms}ms)`);
    console.log(`  duty_date: ${r.dutyDate}   hash: ${r.liveHash}`);
  } else if (r.status === "FAIL") {
    console.log(`  ❌ FAIL — Uyuşmazlık!  (${r.elapsed_ms}ms)`);
    console.log(`  duty_date: ${r.dutyDate}   API status: ${r.apiStatus}`);
    console.log(`  Kaynak (${r.liveNames?.length ?? 0}):  ${r.liveNames?.join(", ")}`);
    console.log(`  API    (${r.apiNames?.length ?? 0}):  ${r.apiNames?.join(", ")}`);
    if (r.missing?.length) {
      console.log(`  Kaynakta var, API'de YOK (${r.missing.length}):`);
      r.missing.forEach((n) => console.log(`    − ${n}`));
    }
    if (r.extra?.length) {
      console.log(`  API'de var, kaynakta YOK (${r.extra.length}):`);
      r.extra.forEach((n) => console.log(`    + ${n}`));
    }
    if (r.mismatch?.length) {
      console.log(`  Yakın ama farklı (${r.mismatch.length}):`);
      r.mismatch.forEach((m) => console.log(`    ≈ ${m.official}  <->  ${m.api} (d=${m.distance})`));
    }
  } else if (r.status === "SOURCE_ERROR") {
    console.log(`  ⚠️  KAYNAK HATASI: ${r.error}`);
  } else if (r.status === "NO_SOURCE_DATA") {
    console.log(`  ⚠️  Kaynak 0 eczane döndürdü.`);
  } else if (r.status === "API_ERROR") {
    console.log(`  ❌ API HATASI: ${r.error}`);
  } else if (r.status === "NO_ENDPOINT") {
    console.log(`  ⚠️  DB'de endpoint yok.`);
  }
}

function printCompact(r) {
  const icon = {
    PASS: "✅", FAIL: "❌", SOURCE_ERROR: "⚠️ ", NO_SOURCE_DATA: "–– ",
    API_ERROR: "❌", NO_ENDPOINT: "⚠️ ",
  }[r.status] ?? "?  ";

  const detail = r.status === "FAIL"
    ? `miss:${r.missing?.length ?? 0} extra:${r.extra?.length ?? 0} mm:${r.mismatch?.length ?? 0} [${r.apiStatus}]`
    : r.status === "SOURCE_ERROR" || r.status === "API_ERROR"
      ? (r.error ?? "").slice(0, 30)
      : r.status === "PASS"
        ? `${r.matched} eşleşti`
        : r.status;

  console.log(`  ${icon} ${pad(r.il, 18)} ${pad(detail, 28)} ${r.dutyDate ?? ""}`);
}

function printSummary(results) {
  const pass    = results.filter((r) => r.status === "PASS").length;
  const fail    = results.filter((r) => r.status === "FAIL").length;
  const srcErr  = results.filter((r) => r.status === "SOURCE_ERROR").length;
  const apiErr  = results.filter((r) => r.status === "API_ERROR").length;
  const noData  = results.filter((r) => r.status === "NO_SOURCE_DATA").length;
  const noEp    = results.filter((r) => r.status === "NO_ENDPOINT").length;

  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ÖZET: ${pass} PASS  |  ${fail} FAIL  |  ${srcErr} kaynak-hata  |  ${noData} veri-yok`);
  if (apiErr) console.log(`         ${apiErr} api-hata`);
  if (noEp)   console.log(`         ${noEp} endpoint-yok`);

  if (fail > 0) {
    console.log(`\n  FAIL olan iller (ingest ile düzeltilebilir):`);
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => {
        console.log(`    ✗ ${r.il}  duty_date=${r.dutyDate}  miss:${r.missing?.length ?? 0} extra:${r.extra?.length ?? 0} mm:${r.mismatch?.length ?? 0}`);
        if (r.missing?.length) console.log(`      Eksik: ${r.missing.join(", ")}`);
        if (r.extra?.length)   console.log(`      Fazla: ${r.extra.join(", ")}`);
        if (r.mismatch?.length) {
          console.log(`      Mismatch: ${r.mismatch.map((m) => `${m.official}<->${m.api}`).join(", ")}`);
        }
      });
    console.log(`\n  Düzeltmek için: node scripts/verify-live.mjs --all --fix`);
  }
  console.log(`${"═".repeat(64)}\n`);
}

main().catch((err) => {
  console.error("[verify-live] fatal:", err);
  process.exit(1);
});
