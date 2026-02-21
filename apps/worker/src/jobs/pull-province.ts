import { DateTime } from "luxon";
import { Pool, PoolClient } from "pg";
import { AdapterRegistry } from "../adapters/registry";
import { checksumPayload } from "../adapters/http-html.adapter";
import { crossCheck } from "../core/cross-check";
import { getDefaultEndpoints } from "../core/default-endpoints";
import { IngestionMetrics } from "../core/metrics";
import { SourceRepository } from "../core/source-repository";
import { ConflictItem, SourceBatch, SourceEndpointConfig, SourceMeta, VerifiedRecord } from "../core/types";

interface PullProvinceJobData {
  provinceSlug: string;
}

interface LoggerLike {
  info(payload: unknown, message?: string): void;
  error(payload: unknown, message?: string): void;
  warn(payload: unknown, message?: string): void;
}

export async function pullProvinceAndPublish(
  data: PullProvinceJobData,
  db: Pool,
  logger: LoggerLike,
  metrics: IngestionMetrics
) {
  const repository = new SourceRepository(db);
  const registry = new AdapterRegistry();

  const dbEndpoints = await repository.listEndpoints(data.provinceSlug);
  const endpoints = dbEndpoints.length ? dbEndpoints : getDefaultEndpoints(data.provinceSlug);
  if (!endpoints.length) {
    await repository.insertAlert({
      provinceSlug: data.provinceSlug,
      alertType: "source_missing",
      severity: "critical",
      message: "No active source_endpoints configured for province"
    });
    metrics.markFailure(data.provinceSlug);
    throw new Error(`No source endpoints for province: ${data.provinceSlug}`);
  }

  if (!dbEndpoints.length) {
    await repository.insertAlert({
      provinceSlug: data.provinceSlug,
      alertType: "source_fallback_to_default_config",
      severity: "warning",
      message: "Using built-in endpoint config because DB source_endpoints is empty",
      payload: { endpoint_count: endpoints.length }
    });
  }

  const primaryEndpoints = endpoints.filter((item) => item.isPrimary);
  const secondaryEndpoints = endpoints.filter((item) => !item.isPrimary);

  const primaryBatch = await pullFromEndpointGroup(
    data.provinceSlug,
    "primary",
    primaryEndpoints,
    repository,
    registry,
    metrics,
    logger
  );

  const secondaryBatch = await pullFromEndpointGroup(
    data.provinceSlug,
    "secondary",
    secondaryEndpoints,
    repository,
    registry,
    metrics,
    logger
  );

  const checked = crossCheck({
    primaryBatch,
    secondaryBatch,
    secondaryExpected: secondaryEndpoints.length > 0
  });
  if (!checked.records.length) {
    await repository.insertAlert({
      provinceSlug: data.provinceSlug,
      alertType: "no_records",
      severity: "critical",
      message: "No records produced after cross-check",
      payload: {
        primary_batch: Boolean(primaryBatch),
        secondary_batch: Boolean(secondaryBatch)
      }
    });
    metrics.markFailure(data.provinceSlug);
    throw new Error(`No records produced for province ${data.provinceSlug}`);
  }

  const client = await db.connect();
  try {
    await client.query("begin");
    const provinceId = await getProvinceId(client, data.provinceSlug);
    if (!provinceId) {
      throw new Error(`Unknown province slug: ${data.provinceSlug}`);
    }

    const recordKeysByDutyDate = new Map<string, Set<string>>();

    for (const record of checked.records) {
      await persistRecord(client, provinceId, record);

      let keySet = recordKeysByDutyDate.get(record.dutyDate);
      if (!keySet) {
        keySet = new Set<string>();
        recordKeysByDutyDate.set(record.dutyDate, keySet);
      }
      keySet.add(buildRecordKey(record.districtSlug, record.normalizedName));
    }

    for (const [dutyDate, keys] of recordKeysByDutyDate.entries()) {
      await expireMissingDutyRecords(client, provinceId, dutyDate, [...keys]);
    }

    for (const conflict of checked.conflicts) {
      await persistConflict(client, provinceId, conflict);
    }

    await client.query("commit");
    metrics.markSuccess(data.provinceSlug, checked.conflicts.length);
    logger.info(
      {
        province: data.provinceSlug,
        records: checked.records.length,
        conflicts: checked.conflicts.length,
        degraded_count: checked.records.filter((r) => r.isDegraded).length
      },
      "Province pull committed"
    );
  } catch (error) {
    await client.query("rollback");
    metrics.markFailure(data.provinceSlug);
    throw error;
  } finally {
    client.release();
  }
}

async function pullFromEndpointGroup(
  provinceSlug: string,
  role: "primary" | "secondary",
  endpoints: SourceEndpointConfig[],
  repository: SourceRepository,
  registry: AdapterRegistry,
  metrics: IngestionMetrics,
  logger: LoggerLike
): Promise<SourceBatch | undefined> {
  const parserThresholdPct = Number(process.env.PARSER_ERROR_THRESHOLD_PCT ?? 20);
  const parserThresholdMinRuns = Number(process.env.PARSER_ERROR_MIN_RUNS ?? 5);

  for (const endpoint of endpoints) {
    const startedAt = new Date();
    try {
      const lastHeaders = await repository.getLatestHeaders(endpoint.sourceEndpointId);
      const conditionalHeaders: Record<string, string> = {};
      if (lastHeaders.etag) {
        conditionalHeaders["If-None-Match"] = lastHeaders.etag;
      }
      if (lastHeaders.lastModified) {
        conditionalHeaders["If-Modified-Since"] = lastHeaders.lastModified;
      }

      const adapter = registry.resolve(endpoint);
      const result = await adapter.fetch(endpoint, conditionalHeaders);

      await repository.insertRun({
        sourceEndpointId: endpoint.sourceEndpointId,
        startedAt,
        finishedAt: new Date(),
        status: role === "secondary" ? "partial" : "success",
        httpStatus: result.httpStatus,
        etag: result.etag ?? null,
        lastModified: result.lastModified ?? null
      });

      await maybeRaiseParserThresholdAlert({
        repository,
        provinceSlug,
        endpoint,
        thresholdPct: parserThresholdPct,
        minRuns: parserThresholdMinRuns,
        logger
      });

      if (result.rawPayload) {
        await repository.insertSnapshot({
          sourceEndpointId: endpoint.sourceEndpointId,
          sourceUrl: endpoint.endpointUrl,
          payload: result.rawPayload,
          checksum: checksumPayload(result.rawPayload)
        });
      }

      return result.batch;
    } catch (error) {
      metrics.markParseError();
      const errorMessage = error instanceof Error ? error.message : "Unknown adapter error";

      await repository.insertRun({
        sourceEndpointId: endpoint.sourceEndpointId,
        startedAt,
        finishedAt: new Date(),
        status: "failed",
        errorMessage
      });

      await maybeRaiseParserThresholdAlert({
        repository,
        provinceSlug,
        endpoint,
        thresholdPct: parserThresholdPct,
        minRuns: parserThresholdMinRuns,
        logger
      });

      await repository.insertAlert({
        provinceSlug,
        sourceEndpointId: endpoint.sourceEndpointId,
        alertType: "adapter_failed",
        severity: role === "primary" ? "critical" : "warning",
        message: `Adapter failed for ${role} source`,
        payload: {
          source_name: endpoint.sourceName,
          endpoint: endpoint.endpointUrl,
          parser_key: endpoint.parserKey,
          error_message: errorMessage
        }
      });

      logger.warn(
        {
          province: provinceSlug,
          role,
          sourceEndpointId: endpoint.sourceEndpointId,
          sourceName: endpoint.sourceName,
          error: errorMessage
        },
        "Endpoint fetch failed"
      );

      if (shouldUseFallback(role)) {
        try {
          const fallback = registry.resolveFallback(endpoint);
          const fallbackResult = await fallback.fetch(endpoint);
          metrics.markFallbackUsed();

          await repository.insertAlert({
            provinceSlug,
            sourceEndpointId: endpoint.sourceEndpointId,
            alertType: "fallback_used",
            severity: "warning",
            message: `Fallback adapter used for ${role} source`,
            payload: {
              source_name: endpoint.sourceName,
              parser_key: endpoint.parserKey
            }
          });

          return fallbackResult.batch;
        } catch (fallbackError) {
          const fallbackMessage =
            fallbackError instanceof Error ? fallbackError.message : "Unknown fallback error";

          await repository.insertAlert({
            provinceSlug,
            sourceEndpointId: endpoint.sourceEndpointId,
            alertType: "fallback_failed",
            severity: "critical",
            message: `Fallback failed for ${role} source`,
            payload: {
              source_name: endpoint.sourceName,
              error_message: fallbackMessage
            }
          });
        }
      }
    }
  }

  return undefined;
}

async function maybeRaiseParserThresholdAlert(params: {
  repository: SourceRepository;
  provinceSlug: string;
  endpoint: SourceEndpointConfig;
  thresholdPct: number;
  minRuns: number;
  logger: LoggerLike;
}) {
  if (params.endpoint.sourceEndpointId <= 0) {
    return;
  }

  const stats = await params.repository.getParserFailureStats(params.endpoint.sourceEndpointId);
  if (stats.totalRuns < params.minRuns || stats.errorRatePct < params.thresholdPct) {
    return;
  }

  const alreadyRaised = await params.repository.hasRecentAlert({
    provinceSlug: params.provinceSlug,
    sourceEndpointId: params.endpoint.sourceEndpointId,
    alertType: "parser_error_threshold",
    minutes: 60
  });

  if (alreadyRaised) {
    return;
  }

  await params.repository.insertAlert({
    provinceSlug: params.provinceSlug,
    sourceEndpointId: params.endpoint.sourceEndpointId,
    alertType: "parser_error_threshold",
    severity: "critical",
    message: `Parser error rate exceeded threshold (${stats.errorRatePct}% >= ${params.thresholdPct}%)`,
    payload: {
      parser_key: params.endpoint.parserKey,
      source_name: params.endpoint.sourceName,
      threshold_pct: params.thresholdPct,
      total_runs_24h: stats.totalRuns,
      failed_runs_24h: stats.failedRuns,
      error_rate_pct_24h: stats.errorRatePct
    }
  });

  params.logger.warn(
    {
      province: params.provinceSlug,
      sourceEndpointId: params.endpoint.sourceEndpointId,
      parserKey: params.endpoint.parserKey,
      stats
    },
    "Parser error threshold exceeded"
  );
}

function shouldUseFallback(role: "primary" | "secondary"): boolean {
  if (process.env.ALLOW_STATIC_FALLBACK !== "1") {
    return false;
  }
  return role === "primary" || process.env.ALLOW_FALLBACK_FOR_SECONDARY === "1";
}

async function getProvinceId(client: PoolClient, slug: string): Promise<number | null> {
  const query = await client.query<{ id: number }>(`select id from provinces where slug = $1`, [slug]);
  return query.rowCount ? query.rows[0].id : null;
}

async function persistRecord(client: PoolClient, provinceId: number, record: VerifiedRecord): Promise<void> {
  const districtId = await upsertDistrict(client, provinceId, record.districtName, record.districtSlug);
  const pharmacyId = await upsertPharmacy(client, provinceId, districtId, record);
  const dutyBounds = resolveDutyBounds(record.dutyDate);

  const dutyRecord = await client.query<{ id: string }>(
    `
    insert into duty_records (
      pharmacy_id, province_id, district_id, duty_date, duty_start, duty_end,
      confidence_score, verification_source_count, last_verified_at, is_degraded
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9)
    on conflict (pharmacy_id, duty_date) do update set
      duty_start = excluded.duty_start,
      duty_end = excluded.duty_end,
      confidence_score = excluded.confidence_score,
      verification_source_count = excluded.verification_source_count,
      last_verified_at = now(),
      is_degraded = excluded.is_degraded,
      updated_at = now()
    returning id::text
    `,
    [
      pharmacyId,
      provinceId,
      districtId,
      record.dutyDate,
      dutyBounds.start,
      dutyBounds.end,
      record.confidenceScore,
      record.verificationSourceCount,
      record.isDegraded
    ]
  );

  const dutyRecordId = dutyRecord.rows[0].id;
  await client.query(`delete from duty_evidence where duty_record_id = $1`, [dutyRecordId]);

  for (const evidence of record.evidence) {
    const sourceId = await upsertSource(
      client,
      provinceId,
      evidence.sourceName,
      evidence.sourceType,
      evidence.authorityWeight,
      evidence.sourceUrl
    );

    await client.query(
      `
      insert into duty_evidence (duty_record_id, source_id, source_url, extracted_payload)
      values ($1, $2, $3, $4::jsonb)
      on conflict (duty_record_id, source_id, source_url) do update set
        extracted_payload = excluded.extracted_payload,
        seen_at = now()
      `,
      [
        dutyRecordId,
        sourceId,
        evidence.sourceUrl,
        JSON.stringify({
          fetchedAt: evidence.fetchedAt,
          sourceType: evidence.sourceType
        })
      ]
    );
  }
}

async function persistConflict(client: PoolClient, provinceId: number, conflict: ConflictItem): Promise<void> {
  const districtId = await upsertDistrict(client, provinceId, conflict.districtSlug, conflict.districtSlug);
  await client.query(
    `
    insert into duty_conflicts (province_id, district_id, duty_date, reason, payload, status)
    values ($1, $2, $3, $4, $5::jsonb, 'open')
    `,
    [provinceId, districtId, conflict.dutyDate, conflict.reason, JSON.stringify(conflict.payload)]
  );
}

async function upsertDistrict(
  client: PoolClient,
  provinceId: number,
  districtName: string,
  districtSlug: string
): Promise<number> {
  const query = await client.query<{ id: number }>(
    `
    insert into districts (province_id, name, slug)
    values ($1, $2, $3)
    on conflict (province_id, slug) do update set
      name = excluded.name
    returning id
    `,
    [provinceId, districtName, districtSlug]
  );
  return query.rows[0].id;
}

async function expireMissingDutyRecords(
  client: PoolClient,
  provinceId: number,
  dutyDate: string,
  activeKeys: string[]
): Promise<void> {
  await client.query(
    `
    with expected_keys as (
      select unnest($3::text[]) as key
    ),
    stale as (
      select dr.id
      from duty_records dr
      join pharmacies ph on ph.id = dr.pharmacy_id
      join districts d on d.id = dr.district_id
      where dr.province_id = $1
        and dr.duty_date = $2
        and dr.duty_end > now()
        and (d.slug || ':' || ph.normalized_name) not in (select key from expected_keys)
    )
    update duty_records
    set duty_end = now() - interval '1 second',
        updated_at = now()
    where id in (select id from stale)
    `,
    [provinceId, dutyDate, activeKeys]
  );
}

async function upsertPharmacy(
  client: PoolClient,
  provinceId: number,
  districtId: number,
  record: VerifiedRecord
): Promise<string> {
  const query = await client.query<{ id: string }>(
    `
    insert into pharmacies (
      province_id, district_id, canonical_name, normalized_name, address, phone, lat, lng, is_active, updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, true, now())
    on conflict (district_id, normalized_name) do update set
      canonical_name = excluded.canonical_name,
      address = excluded.address,
      phone = excluded.phone,
      lat = excluded.lat,
      lng = excluded.lng,
      updated_at = now(),
      is_active = true
    returning id::text
    `,
    [
      provinceId,
      districtId,
      record.pharmacyName,
      record.normalizedName,
      record.address,
      record.phone,
      record.lat,
      record.lng
    ]
  );
  return query.rows[0].id;
}

async function upsertSource(
  client: PoolClient,
  provinceId: number,
  sourceName: string,
  sourceType: SourceMeta["sourceType"],
  authorityWeight: number,
  sourceUrl: string
): Promise<number> {
  const query = await client.query<{ id: number }>(
    `
    insert into sources (province_id, name, type, authority_weight, base_url, enabled, created_at)
    values ($1, $2, $3, $4, $5, true, now())
    on conflict (province_id, name) do update set
      type = excluded.type,
      authority_weight = excluded.authority_weight,
      base_url = excluded.base_url,
      enabled = true
    returning id
    `,
    [provinceId, sourceName, sourceType, authorityWeight, sourceUrl]
  );
  return query.rows[0].id;
}

function resolveDutyBounds(dutyDate: string): { start: string; end: string } {
  const start = DateTime.fromISO(`${dutyDate}T08:00:00`, { zone: "Europe/Istanbul" });
  const end = start.plus({ days: 1 }).set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
  return {
    start: start.toUTC().toISO() ?? "",
    end: end.toUTC().toISO() ?? ""
  };
}

function buildRecordKey(districtSlug: string, normalizedName: string): string {
  return `${districtSlug}:${normalizedName}`;
}
