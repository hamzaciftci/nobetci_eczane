/**
 * Ankara'daki "ECZANESİ" parse artefaktını temizle.
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const raw = readFileSync(".env.local", "utf8");
const vars = Object.fromEntries(
  raw.split("\n").filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")]; })
);
const sql = neon(vars.DATABASE_URL);

const [ankara] = await sql`SELECT id FROM provinces WHERE slug = 'ankara'`;
console.log("Ankara province id:", ankara?.id);

// Find artifact pharmacies (canonical_name = 'ECZANESİ' or normalized = 'ECZANESI')
const artPharmacies = await sql`
  SELECT ph.id, ph.canonical_name, ph.normalized_name
  FROM pharmacies ph
  WHERE ph.province_id = ${ankara.id}
    AND (ph.normalized_name ILIKE 'eczanesi' OR ph.canonical_name ILIKE 'eczanesi')
`;
console.log(`\nArtifact pharmacies: ${artPharmacies.length}`);
for (const r of artPharmacies) {
  console.log(`  id=${r.id} canonical="${r.canonical_name}" normalized="${r.normalized_name}"`);
}

if (artPharmacies.length > 0) {
  const phIds = artPharmacies.map(r => r.id);
  const drDel = await sql`DELETE FROM duty_records WHERE pharmacy_id = ANY(${phIds}) RETURNING id`;
  console.log(`  Deleted ${drDel.length} duty_records.`);
  const phDel = await sql`DELETE FROM pharmacies WHERE id = ANY(${phIds}) RETURNING id`;
  console.log(`  Deleted ${phDel.length} pharmacies.`);
} else {
  console.log("  Nothing to delete.");
}

// Also check duty_records directly for today's Ankara with eczanesi
const today = new Date().toISOString().slice(0, 10);
const artDuty = await sql`
  SELECT dr.id, dr.duty_date, ph.canonical_name, ph.normalized_name
  FROM duty_records dr
  JOIN pharmacies ph ON ph.id = dr.pharmacy_id
  WHERE ph.province_id = ${ankara.id}
    AND (ph.normalized_name ILIKE 'eczanesi' OR ph.canonical_name ILIKE 'eczanesi')
  ORDER BY dr.duty_date DESC
  LIMIT 10
`;
console.log(`\nRemaining duty_records for ECZANESI: ${artDuty.length}`);

// ZEYNEP ULUCAN check
const zu = await sql`
  SELECT ph.id, ph.canonical_name, dr.duty_date
  FROM pharmacies ph
  LEFT JOIN duty_records dr ON dr.pharmacy_id = ph.id
  WHERE ph.province_id = ${ankara.id}
    AND ph.normalized_name ILIKE '%zeynep ulucan%'
  ORDER BY dr.duty_date DESC NULLS LAST
  LIMIT 5
`;
console.log(`\nZEYNEP ULUCAN records: ${zu.length}`);
for (const r of zu) {
  console.log(`  ph.id=${r.id} canonical="${r.canonical_name}" date=${r.duty_date}`);
}

console.log("\nDone.");
