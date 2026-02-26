/**
 * Belirtilen iller için ingest'i doğrudan çalıştır (Vercel olmadan).
 * Kullanım: node scripts/run-ingest.mjs ankara antalya konya
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { ingestProvince } from "../api/_lib/ingest.js";

const raw = readFileSync(".env.local", "utf8");
const vars = Object.fromEntries(
  raw.split("\n").filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")]; })
);

process.env.DATABASE_URL = vars.DATABASE_URL;

const sql = neon(vars.DATABASE_URL);

const slugs = process.argv.slice(2);
if (!slugs.length) {
  console.error("Usage: node scripts/run-ingest.mjs <slug1> [slug2] ...");
  process.exit(1);
}

for (const slug of slugs) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`[${slug.toUpperCase()}] ingesting...`);
  try {
    const result = await ingestProvince(sql, slug);
    console.log(`  status  : ${result.status}`);
    console.log(`  found   : ${result.found}`);
    console.log(`  upserted: ${result.upserted}`);
    console.log(`  elapsed : ${result.elapsed_ms}ms`);
    if (result.error) console.log(`  error   : ${result.error}`);
    if (result.errors?.length) console.log(`  errors  : ${result.errors.join(", ")}`);
  } catch (err) {
    console.log(`  EXCEPTION: ${err.message}`);
  }
}

console.log("\nDone.");
