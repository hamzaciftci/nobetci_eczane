#!/usr/bin/env node
/**
 * Sync DB source_endpoints from code catalog (api/_lib/provinceSources.js).
 *
 * Usage:
 *   node scripts/sync-province-sources.mjs           # dry-run
 *   node scripts/sync-province-sources.mjs --apply   # write DB updates
 */
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import {
  PROVINCE_SOURCES,
  validateProvinceSourceCatalog
} from "../api/_lib/provinceSources.js";

const APPLY = process.argv.includes("--apply");

const envRaw = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envRaw
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const dbUrl = (process.env.DATABASE_URL || env.DATABASE_URL || process.env.NEON_DATABASE_URL || env.NEON_DATABASE_URL || "").trim();
if (!dbUrl) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const issues = validateProvinceSourceCatalog();
const hardIssues = issues.filter((issue) =>
  issue.startsWith("missing_config:") ||
  issue.startsWith("unknown_config_code:") ||
  issue.startsWith("invalid_url:")
);
if (hardIssues.length) {
  console.error("Catalog has hard issues:");
  for (const issue of hardIssues) console.error(`  - ${issue}`);
  process.exit(1);
}

const sql = neon(dbUrl);

const dbRows = await sql`
  select
    p.slug,
    se.id as endpoint_id,
    se.endpoint_url,
    se.parser_key,
    se.format
  from provinces p
  join sources s on s.province_id = p.id
  join source_endpoints se on se.source_id = s.id
  where se.enabled = true
    and se.is_primary = true
  order by p.slug
`;

const dbMap = new Map(dbRows.map((row) => [row.slug, row]));
const catalogMap = new Map(PROVINCE_SOURCES.map((row) => [row.code, row]));

const drift = [];

for (const [slug, cfg] of catalogMap.entries()) {
  const db = dbMap.get(slug);
  if (!db) {
    drift.push({ slug, type: "missing_db_primary_endpoint", config: cfg });
    continue;
  }

  const changes = {};
  if (db.endpoint_url !== cfg.officialSourceUrl) {
    changes.endpoint_url = { db: db.endpoint_url, config: cfg.officialSourceUrl };
  }
  if (db.parser_key !== cfg.parserKey) {
    changes.parser_key = { db: db.parser_key, config: cfg.parserKey };
  }
  if (db.format !== cfg.format) {
    changes.format = { db: db.format, config: cfg.format };
  }

  if (Object.keys(changes).length) {
    drift.push({
      slug,
      type: "endpoint_drift",
      endpoint_id: Number(db.endpoint_id),
      changes
    });
  }
}

for (const [slug] of dbMap.entries()) {
  if (!catalogMap.has(slug)) {
    drift.push({ slug, type: "unknown_db_slug" });
  }
}

console.log(`Catalog entries : ${catalogMap.size}`);
console.log(`DB endpoints    : ${dbMap.size}`);
console.log(`Detected drift  : ${drift.length}`);

if (!drift.length) {
  console.log("No drift detected.");
  process.exit(0);
}

for (const item of drift) {
  console.log(`\n[${item.type}] ${item.slug}`);
  if (item.changes) {
    for (const [field, delta] of Object.entries(item.changes)) {
      console.log(`  ${field}: db="${delta.db}" -> config="${delta.config}"`);
    }
  }
}

if (!APPLY) {
  console.log("\nDry-run complete. Re-run with --apply to persist changes.");
  process.exit(1);
}

let updated = 0;
for (const item of drift) {
  if (item.type !== "endpoint_drift") continue;

  const cfg = catalogMap.get(item.slug);
  await sql`
    update source_endpoints
    set
      endpoint_url = ${cfg.officialSourceUrl},
      parser_key = ${cfg.parserKey},
      format = ${cfg.format}
    where id = ${item.endpoint_id}
  `;
  updated++;
}

console.log(`\nApplied updates: ${updated}`);
process.exit(0);
