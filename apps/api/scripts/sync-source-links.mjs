import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_SOURCE_TYPES = new Set([
  "health_directorate",
  "pharmacists_chamber",
  "official_integration",
  "manual"
]);

const VALID_FORMATS = new Set(["html", "html_table", "html_js", "pdf", "image", "api"]);

const SPECIAL_RULES = [
  {
    test: /osmaniyeeczaciodasi\.org\.tr\/nobetkarti/i,
    sourceName: "Osmaniye Eczaci Odasi",
    sourceType: "pharmacists_chamber",
    format: "html",
    parserKey: "osmaniye_eo_v1"
  },
  {
    test: /nobetcieczane\.adanasm\.gov\.tr/i,
    sourceName: "Adana Il Saglik Mudurlugu",
    sourceType: "health_directorate",
    format: "html_js",
    parserKey: "adana_primary_v1"
  },
  {
    test: /adanaeo\.org\.tr\/nobetci-eczaneler/i,
    sourceName: "Adana Eczaci Odasi",
    sourceType: "pharmacists_chamber",
    format: "html",
    parserKey: "adana_secondary_v1"
  },
  {
    test: /istanbulism\.saglik\.gov\.tr/i,
    sourceName: "Istanbul Il Saglik Mudurlugu",
    sourceType: "health_directorate",
    format: "html",
    parserKey: "istanbul_primary_v1"
  },
  {
    test: /istanbuleczaciodasi\.org\.tr\/nobetci-eczane/i,
    sourceName: "Istanbul Eczaci Odasi",
    sourceType: "pharmacists_chamber",
    format: "html",
    parserKey: "istanbul_secondary_v1"
  }
];

const SOURCE_LINKS_PATH = path.resolve(
  __dirname,
  process.env.SOURCE_LINKS_PATH ?? "../../../infra/sources/province-links.csv"
);

const DEFAULT_POLL_CRON = process.env.SOURCE_POLL_CRON ?? "0 * * * *";
const PRUNE_MISSING_ENDPOINTS = process.env.PRUNE_MISSING_ENDPOINTS === "1";
const REQUIRE_ALL_81 = process.env.REQUIRE_ALL_81 === "1";

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      value += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(value.trim());
      value = "";
      continue;
    }

    value += char;
  }

  values.push(value.trim());
  return values;
}

function parseCsv(content) {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (!lines.length) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = cols[j] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function cleanUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) {
    return "";
  }
  if (!/^https?:\/\//i.test(url)) {
    return "";
  }
  return url;
}

function inferFormat(url, rawFormat) {
  const normalized = String(rawFormat ?? "").trim().toLowerCase();
  if (VALID_FORMATS.has(normalized)) {
    return normalized;
  }

  if (/\.pdf(\?|$)/i.test(url)) {
    return "pdf";
  }

  if (/(\.json(\?|$))|(\/api\/)|(\bapi\b)/i.test(url)) {
    return "api";
  }

  return "html";
}

function inferSourceType(url, role, rawType) {
  const normalized = String(rawType ?? "").trim().toLowerCase();
  if (VALID_SOURCE_TYPES.has(normalized)) {
    return normalized;
  }

  if (/eczaciodasi|eo\.org\.tr/i.test(url)) {
    return "pharmacists_chamber";
  }
  if (/saglik|sm\.gov\.tr|\.gov\.tr/i.test(url)) {
    return "health_directorate";
  }

  return role === "secondary" ? "pharmacists_chamber" : "health_directorate";
}

function findSpecialRule(url) {
  return SPECIAL_RULES.find((rule) => rule.test.test(url));
}

function inferParserKey(url, format, rawParserKey) {
  const parserKey = String(rawParserKey ?? "").trim();
  if (parserKey) {
    return parserKey;
  }

  const special = findSpecialRule(url);
  if (special?.parserKey) {
    return special.parserKey;
  }

  if (format === "pdf") {
    return "generic_pdf_v1";
  }
  if (format === "api") {
    return "generic_api_v1";
  }

  return "generic_auto_v1";
}

function inferSourceName(url, role, provinceName, rawSourceName) {
  const manual = String(rawSourceName ?? "").trim();
  if (manual) {
    return manual;
  }

  const special = findSpecialRule(url);
  if (special?.sourceName) {
    return special.sourceName;
  }

  if (role === "secondary") {
    return `${provinceName} Eczaci Odasi`;
  }
  return `${provinceName} Il Saglik Mudurlugu`;
}

function inferAuthority(role, rawAuthority) {
  const parsed = Number(rawAuthority);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 100) {
    return Math.round(parsed);
  }
  return role === "secondary" ? 80 : 90;
}

function toBaseUrl(url) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

async function upsertSource(client, params) {
  const result = await client.query(
    `
    insert into sources (province_id, name, type, authority_weight, base_url, enabled)
    values ($1, $2, $3, $4, $5, true)
    on conflict (province_id, name) do update set
      type = excluded.type,
      authority_weight = excluded.authority_weight,
      base_url = excluded.base_url,
      enabled = true
    returning id
    `,
    [params.provinceId, params.name, params.type, params.authorityWeight, params.baseUrl]
  );

  return Number(result.rows[0]?.id);
}

async function upsertEndpoint(client, params) {
  const result = await client.query(
    `
    insert into source_endpoints (
      source_id, district_id, endpoint_url, format, parser_key, is_primary, poll_cron, enabled
    )
    values ($1, null, $2, $3, $4, $5, $6, true)
    on conflict (source_id, endpoint_url) do update set
      format = excluded.format,
      parser_key = excluded.parser_key,
      is_primary = excluded.is_primary,
      poll_cron = excluded.poll_cron,
      enabled = true
    returning id
    `,
    [
      params.sourceId,
      params.url,
      params.format,
      params.parserKey,
      params.isPrimary,
      params.pollCron
    ]
  );

  return Number(result.rows[0]?.id);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const csvRaw = await readFile(SOURCE_LINKS_PATH, "utf8");
  const rows = parseCsv(csvRaw);
  if (!rows.length) {
    throw new Error(`No rows found in ${SOURCE_LINKS_PATH}`);
  }

  const client = new Client({
    connectionString,
    ssl:
      process.env.DB_SSL_MODE === "disable"
        ? false
        : {
            rejectUnauthorized: false
          }
  });

  await client.connect();

  try {
    const provincesResult = await client.query("select id, slug, name from provinces order by id asc");
    const provinces = new Map(
      provincesResult.rows.map((row) => [
        String(row.slug),
        { id: Number(row.id), slug: String(row.slug), name: String(row.name) }
      ])
    );

    const unknownProvinceRows = [];
    const touchedProvinceSlugs = new Set();
    const primaryCoverage = new Set();
    const endpointKeysByProvince = new Map();
    let endpointCount = 0;
    let sourceCount = 0;

    await client.query("begin");

    for (const row of rows) {
      const provinceSlug = String(row.province_slug ?? "").trim().toLowerCase();
      if (!provinceSlug) {
        continue;
      }

      const province = provinces.get(provinceSlug);
      if (!province) {
        unknownProvinceRows.push(provinceSlug);
        continue;
      }

      const primaryUrl = cleanUrl(row.primary_url);
      const secondaryUrl = cleanUrl(row.secondary_url);

      if (!primaryUrl && !secondaryUrl) {
        continue;
      }

      touchedProvinceSlugs.add(provinceSlug);

      const endpoints = [
        {
          role: "primary",
          url: primaryUrl,
          rawFormat: row.primary_format,
          rawParserKey: row.primary_parser_key,
          rawSourceName: row.primary_source_name,
          rawSourceType: row.primary_source_type,
          rawAuthority: row.primary_authority_weight
        },
        {
          role: "secondary",
          url: secondaryUrl,
          rawFormat: row.secondary_format,
          rawParserKey: row.secondary_parser_key,
          rawSourceName: row.secondary_source_name,
          rawSourceType: row.secondary_source_type,
          rawAuthority: row.secondary_authority_weight
        }
      ].filter((item) => item.url);

      for (const endpoint of endpoints) {
        const special = findSpecialRule(endpoint.url);
        const format = special?.format ?? inferFormat(endpoint.url, endpoint.rawFormat);
        const parserKey = inferParserKey(endpoint.url, format, endpoint.rawParserKey);
        const sourceType =
          special?.sourceType ?? inferSourceType(endpoint.url, endpoint.role, endpoint.rawSourceType);
        const sourceName = inferSourceName(
          endpoint.url,
          endpoint.role,
          province.name,
          endpoint.rawSourceName
        );
        const authorityWeight = inferAuthority(endpoint.role, endpoint.rawAuthority);
        const pollCron = String(row.poll_cron ?? "").trim() || DEFAULT_POLL_CRON;

        const sourceId = await upsertSource(client, {
          provinceId: province.id,
          name: sourceName,
          type: sourceType,
          authorityWeight,
          baseUrl: toBaseUrl(endpoint.url)
        });
        sourceCount += 1;

        await upsertEndpoint(client, {
          sourceId,
          url: endpoint.url,
          format,
          parserKey,
          isPrimary: endpoint.role === "primary",
          pollCron
        });
        endpointCount += 1;

        const endpointKey = `${sourceId}:${endpoint.url}`;
        const existing = endpointKeysByProvince.get(provinceSlug) ?? new Set();
        existing.add(endpointKey);
        endpointKeysByProvince.set(provinceSlug, existing);

        if (endpoint.role === "primary") {
          primaryCoverage.add(provinceSlug);
        }
      }
    }

    if (unknownProvinceRows.length) {
      throw new Error(`Unknown province_slug values: ${[...new Set(unknownProvinceRows)].join(", ")}`);
    }

    if (PRUNE_MISSING_ENDPOINTS) {
      for (const provinceSlug of touchedProvinceSlugs) {
        const endpointKeys = endpointKeysByProvince.get(provinceSlug);
        if (!endpointKeys || !endpointKeys.size) {
          continue;
        }

        await client.query(
          `
          update source_endpoints se
          set enabled = false
          from sources s
          join provinces p on p.id = s.province_id
          where se.source_id = s.id
            and p.slug = $1
            and (s.id::text || ':' || se.endpoint_url) <> all($2::text[])
          `,
          [provinceSlug, [...endpointKeys]]
        );
      }
    }

    if (REQUIRE_ALL_81 && primaryCoverage.size < provinces.size) {
      const missing = [...provinces.keys()].filter((slug) => !primaryCoverage.has(slug));
      throw new Error(
        `Primary source link missing for ${missing.length} province(s): ${missing.join(", ")}`
      );
    }

    await client.query("commit");

    const missingPrimary = [...provinces.keys()].filter((slug) => !primaryCoverage.has(slug));
    console.log(`[sources:sync] source links file: ${SOURCE_LINKS_PATH}`);
    console.log(`[sources:sync] provinces in DB: ${provinces.size}`);
    console.log(`[sources:sync] provinces updated: ${touchedProvinceSlugs.size}`);
    console.log(`[sources:sync] upsert operations: sources=${sourceCount}, endpoints=${endpointCount}`);
    console.log(`[sources:sync] primary coverage: ${primaryCoverage.size}/${provinces.size}`);
    if (missingPrimary.length) {
      console.log(`[sources:sync] missing primary (${missingPrimary.length}): ${missingPrimary.join(", ")}`);
    }
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[sources:sync] failed", error);
  process.exit(1);
});
