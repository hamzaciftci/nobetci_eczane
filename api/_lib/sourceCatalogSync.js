import {
  PROVINCE_SOURCES,
  validateProvinceSourceCatalog
} from "./provinceSources.js";

const HOURLY_POLL_CRON = "*/30 * * * *";

const SOURCE_TYPE_BY_OFFICIAL = Object.freeze({
  chamber_html: "pharmacists_chamber",
  json_api: "pharmacists_chamber",
  third_party_html: "health_directorate"
});

const AUTHORITY_WEIGHT_BY_SOURCE_TYPE = Object.freeze({
  pharmacists_chamber: 90,
  health_directorate: 85,
  official_integration: 85,
  manual: 70
});

export function getCatalogProvinceSlugs() {
  return PROVINCE_SOURCES.map((entry) => entry.code);
}

export function getCatalogValidationSnapshot() {
  const issues = validateProvinceSourceCatalog();
  return {
    issues,
    hardIssues: issues.filter((issue) =>
      issue.startsWith("missing_config:") ||
      issue.startsWith("unknown_config_code:") ||
      issue.startsWith("invalid_url:")
    )
  };
}

/**
 * Syncs source + primary endpoint rows from code catalog into DB.
 * This makes ingestion deterministic and guarantees 81-il authoritative URLs.
 *
 * @param {*} sql Neon SQL client
 * @param {{ provinceSlugs?: string[] }} [options]
 */
export async function syncCatalogToDb(sql, options = {}) {
  const requested = Array.isArray(options.provinceSlugs) && options.provinceSlugs.length
    ? new Set(options.provinceSlugs.map((slug) => String(slug || "").toLowerCase()).filter(Boolean))
    : null;
  const target = requested
    ? PROVINCE_SOURCES.filter((entry) => requested.has(entry.code))
    : PROVINCE_SOURCES;

  const validation = getCatalogValidationSnapshot();
  const summary = {
    target_count: target.length,
    synced_count: 0,
    created_sources: 0,
    updated_sources: 0,
    created_endpoints: 0,
    updated_endpoints: 0,
    demoted_primary_endpoints: 0,
    missing_provinces: [],
    validation_issues: validation.issues,
    hard_validation_issues: validation.hardIssues,
    synced_at: new Date().toISOString()
  };

  if (!target.length) {
    return summary;
  }

  const targetSlugs = target.map((entry) => entry.code);
  const provinceRows = await sql`
    SELECT id, slug
    FROM provinces
    WHERE slug = ANY(${targetSlugs})
  `;
  const provinceBySlug = new Map(
    provinceRows.map((row) => [String(row.slug).toLowerCase(), Number(row.id)])
  );

  for (const cfg of target) {
    const provinceId = provinceBySlug.get(cfg.code);
    if (!provinceId) {
      summary.missing_provinces.push(cfg.code);
      continue;
    }

    const sourceType = SOURCE_TYPE_BY_OFFICIAL[cfg.officialSourceType] ?? "manual";
    const authorityWeight = AUTHORITY_WEIGHT_BY_SOURCE_TYPE[sourceType] ?? 70;

    const existingSourceRows = await sql`
      SELECT id
      FROM sources
      WHERE province_id = ${provinceId}
        AND name = ${cfg.sourceName}
      LIMIT 1
    `;

    let sourceId = null;
    if (existingSourceRows.length) {
      sourceId = Number(existingSourceRows[0].id);
      summary.updated_sources++;
      await sql`
        UPDATE sources
        SET
          type = ${sourceType}::source_type,
          authority_weight = ${authorityWeight},
          base_url = ${cfg.baseUrl},
          enabled = true
        WHERE id = ${sourceId}
      `;
    } else {
      const insertedSourceRows = await sql`
        INSERT INTO sources (
          province_id, name, type, authority_weight, base_url, enabled, created_at
        )
        VALUES (
          ${provinceId},
          ${cfg.sourceName},
          ${sourceType}::source_type,
          ${authorityWeight},
          ${cfg.baseUrl},
          true,
          now()
        )
        RETURNING id
      `;
      sourceId = Number(insertedSourceRows[0].id);
      summary.created_sources++;
    }

    const existingEndpointRows = await sql`
      SELECT id
      FROM source_endpoints
      WHERE source_id = ${sourceId}
        AND endpoint_url = ${cfg.officialSourceUrl}
      LIMIT 1
    `;

    let endpointId = null;
    if (existingEndpointRows.length) {
      endpointId = Number(existingEndpointRows[0].id);
      summary.updated_endpoints++;
      await sql`
        UPDATE source_endpoints
        SET
          format = ${cfg.format}::source_format,
          parser_key = ${cfg.parserKey},
          enabled = true,
          poll_cron = ${HOURLY_POLL_CRON},
          is_primary = true
        WHERE id = ${endpointId}
      `;
    } else {
      const insertedEndpointRows = await sql`
        INSERT INTO source_endpoints (
          source_id, district_id, endpoint_url, format, parser_key, is_primary, poll_cron, enabled
        )
        VALUES (
          ${sourceId},
          null,
          ${cfg.officialSourceUrl},
          ${cfg.format}::source_format,
          ${cfg.parserKey},
          true,
          ${HOURLY_POLL_CRON},
          true
        )
        ON CONFLICT (source_id, endpoint_url) DO UPDATE SET
          format = EXCLUDED.format,
          parser_key = EXCLUDED.parser_key,
          enabled = true,
          poll_cron = EXCLUDED.poll_cron,
          is_primary = true
        RETURNING id
      `;
      endpointId = Number(insertedEndpointRows[0].id);
      summary.created_endpoints++;
    }

    const demotedRows = await sql`
      UPDATE source_endpoints se
      SET is_primary = false
      FROM sources s
      WHERE se.source_id = s.id
        AND s.province_id = ${provinceId}
        AND se.id <> ${endpointId}
        AND se.is_primary = true
      RETURNING se.id
    `;

    summary.demoted_primary_endpoints += demotedRows.length;
    summary.synced_count++;
  }

  return summary;
}
