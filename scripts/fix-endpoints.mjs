/**
 * Fix incorrect endpoint URLs in the DB.
 * Afyonkarahisar's primary endpoint was set to the homepage instead of
 * the actual pharmacy listing page.
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const envLocal = readFileSync(".env.local", "utf8");
const envVars = Object.fromEntries(
  envLocal.split("\n")
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const sql = neon(envVars.DATABASE_URL);

const fixes = [
  {
    province: "afyonkarahisar",
    old_url: "https://www.afyoneczaciodasi.org.tr/",
    new_url: "https://www.afyoneczaciodasi.org.tr/nobetci-eczaneler"
  }
];

for (const fix of fixes) {
  console.log(`Fixing ${fix.province}: ${fix.old_url} → ${fix.new_url}`);

  const result = await sql`
    UPDATE source_endpoints se
    SET endpoint_url = ${fix.new_url}
    FROM sources s
    JOIN provinces p ON p.id = s.province_id
    WHERE se.source_id = s.id
      AND p.slug = ${fix.province}
      AND se.endpoint_url = ${fix.old_url}
      AND se.is_primary = true
    RETURNING se.id, se.endpoint_url
  `;

  if (result.length > 0) {
    console.log(`  ✓ Updated ${result.length} endpoint(s)`);
  } else {
    console.log(`  ! No matching endpoint found (may already be fixed)`);

    // Show current state
    const current = await sql`
      SELECT se.id, se.endpoint_url, p.slug
      FROM source_endpoints se
      JOIN sources s ON s.id = se.source_id
      JOIN provinces p ON p.id = s.province_id
      WHERE p.slug = ${fix.province} AND se.is_primary = true
    `;
    current.forEach(r => console.log(`  Current: ${r.endpoint_url}`));
  }
}

process.exit(0);
