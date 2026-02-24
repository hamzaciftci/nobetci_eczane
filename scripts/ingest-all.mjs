/**
 * Local script: ingest duty pharmacies for all 81 provinces.
 *
 * Usage:
 *   node scripts/ingest-all.mjs               # all provinces
 *   node scripts/ingest-all.mjs ankara izmir  # specific provinces
 *   node scripts/ingest-all.mjs --concurrency=4  # 4 parallel (default: 3)
 *
 * Reads DATABASE_URL from .env.local
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { ingestProvince } from "../api/_lib/ingest.js";

// ─── Config ───────────────────────────────────────────────────────────────

const DEFAULT_CONCURRENCY = 3;

// ─── Bootstrap DB ─────────────────────────────────────────────────────────

const envLocal = readFileSync(".env.local", "utf8");
const envVars = Object.fromEntries(
  envLocal.split("\n")
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
    .filter(([k]) => k)
);

const dbUrl = envVars.DATABASE_URL || envVars.POSTGRES_URL || envVars.POSTGRES_PRISMA_URL;
if (!dbUrl) {
  console.error("ERROR: No DATABASE_URL found in .env.local");
  process.exit(1);
}

const sql = neon(dbUrl);

// ─── Parse CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let concurrency = DEFAULT_CONCURRENCY;
const specificSlugs = [];

for (const arg of args) {
  if (arg.startsWith("--concurrency=")) {
    concurrency = Number(arg.split("=")[1]) || DEFAULT_CONCURRENCY;
  } else if (!arg.startsWith("--")) {
    specificSlugs.push(arg.toLowerCase());
  }
}

// ─── Get province slugs ────────────────────────────────────────────────────

let slugs;
if (specificSlugs.length) {
  slugs = specificSlugs;
} else {
  const rows = await sql`
    SELECT DISTINCT p.slug
    FROM source_endpoints se
    JOIN sources   s ON s.id = se.source_id
    JOIN provinces p ON p.id = s.province_id
    WHERE se.is_primary = true
      AND se.enabled    = true
    ORDER BY p.slug
  `;
  slugs = rows.map(r => r.slug);
}

console.log(`\n=== Nöbetçi Eczane Ingestion ===`);
console.log(`Provinces : ${slugs.length}`);
console.log(`Concurrency: ${concurrency}`);
console.log(`Started   : ${new Date().toLocaleString("tr-TR")}\n`);

// ─── Run with concurrency limit ────────────────────────────────────────────

const results = [];
let completed = 0;

async function runSlug(slug) {
  const result = await ingestProvince(sql, slug);
  completed++;
  const pct = Math.round(completed / slugs.length * 100);
  const icon = result.status === "success" ? "✓" :
               result.status === "partial" ? "~" :
               result.status === "no_data" ? "?" : "✗";
  const detail = result.found > 0
    ? `${result.upserted}/${result.found} upserted`
    : (result.error ?? result.status);

  console.log(`[${String(completed).padStart(2)}/${slugs.length}] ${pct.toString().padStart(3)}% ${icon} ${slug.padEnd(18)} ${detail} (${result.elapsed_ms}ms)`);
  if (result.errors?.length) {
    console.log(`   ↳ errors: ${result.errors.join("; ")}`);
  }
  return result;
}

// Process in batches of `concurrency`
for (let i = 0; i < slugs.length; i += concurrency) {
  const batch = slugs.slice(i, i + concurrency);
  const batchResults = await Promise.allSettled(batch.map(runSlug));
  results.push(...batchResults.map((s, j) =>
    s.status === "fulfilled" ? s.value : { status: "error", il: batch[j], error: s.reason?.message }
  ));
}

// ─── Summary ──────────────────────────────────────────────────────────────

const success = results.filter(r => r.status === "success").length;
const partial = results.filter(r => r.status === "partial").length;
const noData  = results.filter(r => r.status === "no_data").length;
const failed  = results.filter(r => !["success", "partial", "no_data"].includes(r.status)).length;
const totalUpserted = results.reduce((s, r) => s + (r.upserted ?? 0), 0);
const totalFound    = results.reduce((s, r) => s + (r.found    ?? 0), 0);

console.log("\n=== Summary ===");
console.log(`  ✓ Success : ${success}`);
console.log(`  ~ Partial : ${partial}`);
console.log(`  ? No data : ${noData}`);
console.log(`  ✗ Failed  : ${failed}`);
console.log(`  Records   : ${totalUpserted}/${totalFound} upserted`);
console.log(`  Finished  : ${new Date().toLocaleString("tr-TR")}\n`);

if (failed > 0) {
  console.log("=== Failed provinces ===");
  results.filter(r => !["success", "partial", "no_data"].includes(r.status))
    .forEach(r => console.log(`  ${r.il}: ${r.error ?? r.status}`));
}

process.exit(failed > 0 ? 1 : 0);
