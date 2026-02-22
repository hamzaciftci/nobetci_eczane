import { Pool } from "pg";
import { SourceEndpointConfig } from "./types";

interface EndpointRow {
  source_endpoint_id: number;
  source_id: number;
  province_slug: string;
  source_name: string;
  source_type: SourceEndpointConfig["sourceType"];
  authority_weight: number;
  endpoint_url: string;
  format: SourceEndpointConfig["format"];
  parser_key: string;
  is_primary: boolean;
}

interface HeaderRow {
  etag: string | null;
  last_modified: string | null;
}

interface FailureStatsRow {
  total_runs: string;
  failed_runs: string;
  error_rate_pct: string | null;
}

interface ExistingAlertRow {
  exists: boolean;
}

export class SourceRepository {
  constructor(private readonly db: Pool) {}

  async listEndpoints(provinceSlug: string): Promise<SourceEndpointConfig[]> {
    const result = await this.db.query<EndpointRow>(
      `
      select
        se.id as source_endpoint_id,
        s.id as source_id,
        p.slug as province_slug,
        s.name as source_name,
        s.type as source_type,
        s.authority_weight,
        se.endpoint_url,
        se.format,
        se.parser_key,
        se.is_primary
      from source_endpoints se
      join sources s on s.id = se.source_id
      join provinces p on p.id = s.province_id
      where p.slug = $1
        and s.enabled = true
        and se.enabled = true
      order by se.is_primary desc, s.authority_weight desc, se.id asc
      `,
      [provinceSlug]
    );

    return result.rows.map((row) => ({
      sourceEndpointId: row.source_endpoint_id,
      sourceId: row.source_id,
      provinceSlug: row.province_slug,
      sourceName: row.source_name,
      sourceType: row.source_type,
      authorityWeight: row.authority_weight,
      endpointUrl: row.endpoint_url,
      format: row.format,
      parserKey: row.parser_key,
      isPrimary: row.is_primary
    }));
  }

  async getLatestHeaders(sourceEndpointId: number): Promise<{ etag?: string; lastModified?: string }> {
    if (sourceEndpointId <= 0) {
      return {};
    }

    const result = await this.db.query<HeaderRow>(
      `
      select etag, last_modified
      from ingestion_runs
      where source_endpoint_id = $1
        and status in ('success', 'partial')
      order by started_at desc
      limit 1
      `,
      [sourceEndpointId]
    );

    if (!result.rowCount) {
      return {};
    }

    return {
      etag: result.rows[0].etag ?? undefined,
      lastModified: result.rows[0].last_modified ?? undefined
    };
  }

  async insertRun(params: {
    sourceEndpointId: number;
    startedAt: Date;
    status: "success" | "partial" | "failed";
    httpStatus?: number;
    etag?: string | null;
    lastModified?: string | null;
    errorMessage?: string | null;
    finishedAt?: Date;
  }): Promise<void> {
    if (params.sourceEndpointId <= 0) {
      return;
    }

    await this.db.query(
      `
      insert into ingestion_runs (
        source_endpoint_id, started_at, finished_at, status, http_status, etag, last_modified, error_message
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        params.sourceEndpointId,
        params.startedAt.toISOString(),
        (params.finishedAt ?? new Date()).toISOString(),
        params.status,
        params.httpStatus ?? null,
        params.etag ?? null,
        params.lastModified ?? null,
        params.errorMessage ?? null
      ]
    );
  }

  async insertSnapshot(params: {
    sourceEndpointId: number;
    sourceUrl: string;
    payload: string;
    checksum: string;
  }): Promise<void> {
    if (params.sourceEndpointId <= 0) {
      return;
    }

    await this.db.query(
      `
      insert into source_snapshots (source_endpoint_id, source_url, raw_payload, checksum)
      values ($1, $2, $3, $4)
      `,
      [params.sourceEndpointId, params.sourceUrl, params.payload, params.checksum]
    );
  }

  async insertAlert(params: {
    provinceSlug: string;
    sourceEndpointId?: number;
    alertType: string;
    severity: "info" | "warning" | "critical";
    message: string;
    payload?: unknown;
  }): Promise<void> {
    try {
      await this.db.query(
        `
        insert into ingestion_alerts (
          province_id, source_endpoint_id, alert_type, severity, message, payload
        )
        select p.id, $2, $3, $4, $5, $6::jsonb
        from provinces p
        where p.slug = $1
        `,
        [
          params.provinceSlug,
          params.sourceEndpointId && params.sourceEndpointId > 0 ? params.sourceEndpointId : null,
          params.alertType,
          params.severity,
          params.message,
          JSON.stringify(params.payload ?? {})
        ]
      );
    } catch {
      // Alert table may not exist in old local databases; skip hard failure.
    }
  }

  async getParserFailureStats(sourceEndpointId: number): Promise<{
    totalRuns: number;
    failedRuns: number;
    errorRatePct: number;
  }> {
    if (sourceEndpointId <= 0) {
      return {
        totalRuns: 0,
        failedRuns: 0,
        errorRatePct: 0
      };
    }

    const rows = await this.db.query<FailureStatsRow>(
      `
      select
        count(*)::text as total_runs,
        count(*) filter (where status = 'failed')::text as failed_runs,
        round(
          (count(*) filter (where status = 'failed')::numeric / nullif(count(*), 0)) * 100, 2
        )::text as error_rate_pct
      from ingestion_runs
      where source_endpoint_id = $1
        and started_at > now() - interval '24 hour'
      `,
      [sourceEndpointId]
    );

    return {
      totalRuns: Number(rows.rows[0]?.total_runs ?? 0),
      failedRuns: Number(rows.rows[0]?.failed_runs ?? 0),
      errorRatePct: Number(rows.rows[0]?.error_rate_pct ?? 0)
    };
  }

  async hasRecentAlert(params: {
    provinceSlug: string;
    sourceEndpointId?: number;
    alertType: string;
    minutes: number;
  }): Promise<boolean> {
    if (!params.sourceEndpointId || params.sourceEndpointId <= 0) {
      return false;
    }

    try {
      const result = await this.db.query<ExistingAlertRow>(
        `
        select exists(
          select 1
          from ingestion_alerts ia
          join provinces p on p.id = ia.province_id
          where p.slug = $1
            and ia.source_endpoint_id = $2
            and ia.alert_type = $3
            and ia.created_at > now() - make_interval(mins => $4)
        ) as "exists"
        `,
        [params.provinceSlug, params.sourceEndpointId, params.alertType, params.minutes]
      );

      return Boolean(result.rows[0]?.exists);
    } catch {
      return false;
    }
  }

  async enqueueRetry(params: {
    provinceSlug: string;
    sourceEndpointId?: number;
    reason: string;
    payload?: unknown;
    delayMinutes?: number;
  }): Promise<void> {
    try {
      await this.db.query(
        `
        insert into ingestion_retry_queue (
          province_slug,
          source_endpoint_id,
          reason,
          payload,
          retry_count,
          next_retry_at,
          status,
          created_at,
          updated_at
        )
        values (
          $1,
          $2,
          $3,
          $4::jsonb,
          0,
          now() + make_interval(mins => $5),
          'pending',
          now(),
          now()
        )
        `,
        [
          params.provinceSlug,
          params.sourceEndpointId && params.sourceEndpointId > 0 ? params.sourceEndpointId : null,
          params.reason,
          JSON.stringify(params.payload ?? {}),
          Math.max(1, params.delayMinutes ?? 5)
        ]
      );
    } catch {
      // Retry queue table may not exist yet in old databases.
    }
  }
}
