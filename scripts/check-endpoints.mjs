import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const raw = readFileSync(".env.local", "utf8");
const vars = Object.fromEntries(
  raw.split("\n").filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")]; })
);
const sql = neon(vars.DATABASE_URL);

const slugs = ["ankara","antalya","aydin","konya","nigde","ordu"];

const rows = await sql`
  SELECT p.slug, p.name, se.endpoint_url, se.parser_key, se.format
  FROM provinces p
  JOIN sources s ON s.province_id = p.id
  JOIN source_endpoints se ON se.source_id = s.id AND se.is_primary = true AND se.enabled = true
  WHERE p.slug = ANY(${slugs})
  ORDER BY p.slug
`;

for (const r of rows) {
  console.log(`\n${r.slug} (${r.name})`);
  console.log(`  URL   : ${r.endpoint_url}`);
  console.log(`  Parser: ${r.parser_key}  Format: ${r.format}`);
}
