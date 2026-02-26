import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const raw = readFileSync(".env.local", "utf8");
const vars = Object.fromEntries(
  raw.split("\n").filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")]; })
);
const sql = neon(vars.DATABASE_URL);

// Mevcut Ankara endpoint'ini göster
const before = await sql`
  SELECT se.id, se.endpoint_url, se.parser_key
  FROM source_endpoints se
  JOIN sources s ON s.id = se.source_id
  JOIN provinces p ON p.id = s.province_id
  WHERE p.slug = 'ankara' AND se.is_primary = true AND se.enabled = true
  LIMIT 1
`;
console.log("Before:", before[0]);

await sql`
  UPDATE source_endpoints
  SET endpoint_url = 'https://www.aeo.org.tr/nobetci-eczaneler',
      parser_key   = 'ankara_ajax_v1'
  WHERE id = ${before[0].id}
`;

const after = await sql`
  SELECT se.endpoint_url, se.parser_key
  FROM source_endpoints se WHERE se.id = ${before[0].id}
`;
console.log("After:", after[0]);
