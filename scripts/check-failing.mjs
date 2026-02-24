/**
 * Diagnose provinces with 0 duty records today.
 * Shows their endpoints and fetches a snippet of HTML to detect structure.
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

const CRAWL_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0";

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

// Get failing provinces
const rows = await sql`
  SELECT p.slug, p.name, se.endpoint_url, se.parser_key
  FROM provinces p
  JOIN sources s ON s.province_id = p.id
  JOIN source_endpoints se ON se.source_id = s.id
  WHERE se.is_primary = true AND se.enabled = true
    AND p.id NOT IN (
      SELECT DISTINCT ph.province_id
      FROM pharmacies ph
      JOIN duty_records dr ON dr.pharmacy_id = ph.id
      WHERE dr.duty_date = ${today}
    )
  ORDER BY p.slug
`;

console.log(`\nProvinces with 0 duty records on ${today}: ${rows.length}\n`);

// Fetch each and inspect
for (const row of rows) {
  process.stdout.write(`${row.slug.padEnd(18)} ${row.parser_key.padEnd(25)} `);

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const resp = await fetch(row.endpoint_url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": CRAWL_UA,
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
        "Accept-Language": "tr-TR,tr;q=0.9"
      }
    });
    clearTimeout(timer);

    const buf = await resp.arrayBuffer();
    const html = new TextDecoder("utf-8").decode(buf);
    const lower = html.toLowerCase();

    const tables = (html.match(/<table/gi) || []).length;
    const telLinks = (html.match(/href="tel:/gi) || []).length;
    const h4s = (html.match(/<h4/gi) || []).length;
    const h1s = (html.match(/<h1/gi) || []).length;
    const dataName = html.includes('data-name=');
    const hasAjax = /getPharm/i.test(html);
    const hasEczane = /eczane/i.test(html);
    const hasPhonePattern = (html.match(/\b0?\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g) || []).length;
    const liCount = (html.match(/<li\s/gi) || []).length;
    const spanEcz = (html.match(/span[^>]*>[^<]*ecz/gi) || []).length;
    const strongCount = (html.match(/<strong/gi) || []).length;

    console.log(`tbl=${tables} tel=${telLinks} h1=${h1s} h4=${h4s} li=${liCount} strong=${strongCount} phone=${hasPhonePattern} ajax=${hasAjax} data-name=${dataName} ecz=${hasEczane}`);

    // Show a sample near a tel: link or phone number
    let sampleIdx = lower.indexOf('href="tel:');
    if (sampleIdx < 0) sampleIdx = lower.search(/eczane/);
    if (sampleIdx >= 0) {
      const snippet = html.slice(Math.max(0, sampleIdx - 200), sampleIdx + 500)
        .replace(/\s+/g, " ")
        .replace(/<(script|style)[^>]*>[\s\S]*?<\/(script|style)>/gi, "")
        .slice(0, 600);
      console.log(`  SNIPPET: ...${snippet}...`);
    }
  } catch (err) {
    console.log(`ERROR: ${err.message.slice(0, 80)}`);
  }

  console.log();
}

process.exit(0);
