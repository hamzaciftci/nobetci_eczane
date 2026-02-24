import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const envLocal = readFileSync(".env.local", "utf8");
const envVars = Object.fromEntries(
  envLocal.split("\n")
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g, "")]; })
    .filter(([k]) => k)
);
const dbUrl = envVars.DATABASE_URL || envVars.POSTGRES_URL || envVars.POSTGRES_PRISMA_URL;
const sql = neon(dbUrl);

// 1. How many today's duty_records have duty_evidence?
const evCheck = await sql`
  SELECT
    COUNT(DISTINCT dr.id)::int AS total_today_records,
    COUNT(DISTINCT de.duty_record_id)::int AS records_with_evidence
  FROM duty_records dr
  LEFT JOIN duty_evidence de ON de.duty_record_id = dr.id
  WHERE dr.duty_date = (now() AT TIME ZONE 'Europe/Istanbul')::date
`;
console.log("=== duty_evidence check for today ===");
console.log(JSON.stringify(evCheck[0]));

// 2. Sample today's duty_records with pharmacy info (no evidence needed)
const sample = await sql`
  SELECT dr.id, dr.duty_date, dr.province_id, pr.slug, dr.is_degraded,
         ph.canonical_name, ph.address, ph.phone
  FROM duty_records dr
  JOIN pharmacies ph ON ph.id = dr.pharmacy_id
  JOIN provinces pr ON pr.id = dr.province_id
  WHERE dr.duty_date = (now() AT TIME ZONE 'Europe/Istanbul')::date
  LIMIT 5
`;
console.log("\n=== Sample today's records (with pharmacy info) ===");
sample.forEach(r => console.log(r.slug, "|", r.canonical_name, "|", r.phone));

// 3. Province distribution of today's records
const byProv = await sql`
  SELECT pr.slug, pr.name, COUNT(*)::int as cnt
  FROM duty_records dr
  JOIN provinces pr ON pr.id = dr.province_id
  WHERE dr.duty_date = (now() AT TIME ZONE 'Europe/Istanbul')::date
  GROUP BY pr.slug, pr.name
  ORDER BY pr.name
`;
console.log("\n=== Today's records by province ===");
byProv.forEach(r => console.log(r.slug.padEnd(20), r.cnt, "records"));
console.log("Total provinces with today's data:", byProv.length);

// 4. Sources table structure
const srcCols = await sql`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'sources' ORDER BY ordinal_position
`;
console.log("\n=== sources TABLE columns ===");
srcCols.forEach(c => console.log(" ", c.column_name, "-", c.data_type));

// 5. Sample sources
const srcSample = await sql`SELECT id, name, province_id FROM sources LIMIT 5`;
console.log("\n=== Sample sources ===");
srcSample.forEach(r => console.log(JSON.stringify(r)));
