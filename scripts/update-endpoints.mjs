/**
 * DB: Konya/Niğde/Aydın/Ordu için endpoint URL ve parser_key güncelle
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const raw = readFileSync(".env.local", "utf8");
const vars = Object.fromEntries(
  raw.split("\n").filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")]; })
);
const sql = neon(vars.DATABASE_URL);

const updates = [
  {
    slug: "konya",
    endpoint_url: "http://www.konyanobetcieczaneleri.com",
    parser_key: "konya_v1",
  },
  {
    slug: "nigde",
    parser_key: "teknoecza_v1",
  },
  {
    slug: "aydin",
    parser_key: "teknoecza_v2",
  },
  {
    slug: "ordu",
    parser_key: "eczanesistemi_iframe_v1",
  },
];

for (const u of updates) {
  const rows = await sql`
    SELECT se.id, se.endpoint_url, se.parser_key
    FROM source_endpoints se
    JOIN sources s ON s.id = se.source_id
    JOIN provinces p ON p.id = s.province_id
    WHERE p.slug = ${u.slug}
      AND se.is_primary = true
      AND se.enabled = true
    LIMIT 1
  `;

  if (!rows.length) {
    console.log(`[SKIP] ${u.slug}: no primary enabled endpoint found`);
    continue;
  }

  const ep = rows[0];
  const newUrl = u.endpoint_url ?? ep.endpoint_url;
  const newKey = u.parser_key ?? ep.parser_key;

  await sql`
    UPDATE source_endpoints
    SET endpoint_url = ${newUrl},
        parser_key   = ${newKey}
    WHERE id = ${ep.id}
  `;

  console.log(`[OK] ${u.slug}: endpoint_url="${newUrl}" parser_key="${newKey}"`);
}

console.log("\nDone.");
