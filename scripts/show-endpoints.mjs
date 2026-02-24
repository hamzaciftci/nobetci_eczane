import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const envLocal = readFileSync(".env.local", "utf8");
const envVars = Object.fromEntries(
  envLocal.split("\n")
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const sql = neon(envVars.DATABASE_URL);

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

const rows = await sql`
  SELECT p.slug, p.name, se.endpoint_url, se.parser_key, se.format,
         COUNT(dr.id) as duty_count
  FROM provinces p
  JOIN sources s ON s.province_id = p.id
  JOIN source_endpoints se ON se.source_id = s.id
  LEFT JOIN pharmacies ph ON ph.province_id = p.id
  LEFT JOIN duty_records dr ON dr.pharmacy_id = ph.id AND dr.duty_date = ${today}
  WHERE se.is_primary = true AND se.enabled = true
  GROUP BY p.slug, p.name, se.endpoint_url, se.parser_key, se.format
  HAVING COUNT(dr.id) = 0
  ORDER BY p.slug
`;

console.log(`Failing provinces (${rows.length}) on ${today}:\n`);
for (const r of rows) {
  console.log(`${r.slug}`);
  console.log(`  URL    : ${r.endpoint_url}`);
  console.log(`  Parser : ${r.parser_key}  Format: ${r.format}`);
  console.log();
}

process.exit(0);
