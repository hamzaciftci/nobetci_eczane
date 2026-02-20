import { BadRequestException, Injectable } from "@nestjs/common";
import { normalizePharmacyName, resolveActiveDutyWindow, toSlug } from "@nobetci/shared";
import { QueryResultRow } from "pg";
import { ApiMetricsService } from "../../infra/api-metrics.service";
import { DatabaseService } from "../../infra/database.service";
import { RedisService } from "../../infra/redis.service";
import { ManualOverrideDto } from "./manual-override.dto";

type OverviewRow = QueryResultRow & {
  il: string;
  success_count: string;
  failed_count: string;
  partial_count: string;
  last_run_at: string | null;
  alert_count: string;
};

type ProvinceRunsRow = QueryResultRow & {
  source_name: string;
  endpoint_url: string;
  status: "success" | "partial" | "failed";
  started_at: string;
  error_message: string | null;
};

type AlertRow = QueryResultRow & {
  id: string;
  il: string;
  source_endpoint_id: string | null;
  alert_type: string;
  severity: string;
  message: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
};

type ParserRow = QueryResultRow & {
  il: string;
  parser_key: string;
  total_runs: string;
  failed_runs: string;
  parser_error_rate: string;
};

type CoverageRow = QueryResultRow & {
  updated_24h: string;
  total_with_sources: string;
  coverage_ratio: string;
};

type ConflictRow = QueryResultRow & {
  conflicts_24h: string;
  verified_24h: string;
  conflict_ratio: string;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly apiMetrics: ApiMetricsService,
    private readonly redis: RedisService
  ) {}

  async ingestionOverview() {
    const rows = await this.db.query<OverviewRow>(
      `
      select
        p.slug as il,
        count(*) filter (where ir.status = 'success')::text as success_count,
        count(*) filter (where ir.status = 'failed')::text as failed_count,
        count(*) filter (where ir.status = 'partial')::text as partial_count,
        max(ir.started_at)::text as last_run_at,
        coalesce((
          select count(*)::text
          from ingestion_alerts ia
          where ia.province_id = p.id
            and ia.created_at > now() - interval '24 hour'
        ), '0') as alert_count
      from provinces p
      left join sources s on s.province_id = p.id
      left join source_endpoints se on se.source_id = s.id
      left join ingestion_runs ir on ir.source_endpoint_id = se.id
        and ir.started_at > now() - interval '24 hour'
      group by p.id, p.slug
      order by p.slug asc
      `
    );

    return rows.rows.map((row) => ({
      il: row.il,
      success_count: Number(row.success_count),
      failed_count: Number(row.failed_count),
      partial_count: Number(row.partial_count),
      last_run_at: row.last_run_at,
      alert_count: Number(row.alert_count)
    }));
  }

  async ingestionByProvince(ilSlug: string) {
    const runs = await this.db.query<ProvinceRunsRow>(
      `
      select
        s.name as source_name,
        se.endpoint_url,
        ir.status,
        ir.started_at::text,
        ir.error_message
      from provinces p
      join sources s on s.province_id = p.id
      join source_endpoints se on se.source_id = s.id
      join ingestion_runs ir on ir.source_endpoint_id = se.id
      where p.slug = $1
      order by ir.started_at desc
      limit 50
      `,
      [ilSlug]
    );

    const alerts = await this.db.query<AlertRow>(
      `
      select alert_type, severity, message, created_at::text
      from ingestion_alerts ia
      join provinces p on p.id = ia.province_id
      where p.slug = $1
      order by ia.created_at desc
      limit 50
      `,
      [ilSlug]
    );

    return {
      il: ilSlug,
      runs: runs.rows,
      alerts: alerts.rows
    };
  }

  async ingestionMetrics() {
    try {
      const parserRows = await this.db.query<ParserRow>(
        `
        select
          p.slug as il,
          se.parser_key,
          count(*)::text as total_runs,
          count(*) filter (where ir.status = 'failed')::text as failed_runs,
          round(
            (count(*) filter (where ir.status = 'failed')::numeric / nullif(count(*), 0)) * 100, 2
          )::text as parser_error_rate
        from ingestion_runs ir
        join source_endpoints se on se.id = ir.source_endpoint_id
        join sources s on s.id = se.source_id
        join provinces p on p.id = s.province_id
        where ir.started_at > now() - interval '24 hour'
        group by p.slug, se.parser_key
        order by parser_error_rate desc nulls last, total_runs desc
        `
      );

      const coverage = await this.db.query<CoverageRow>(
        `
        with province_sources as (
          select distinct p.id, p.slug
          from provinces p
          join sources s on s.province_id = p.id and s.enabled = true
          join source_endpoints se on se.source_id = s.id and se.enabled = true
        ),
        province_updates as (
          select p.id, max(dr.last_verified_at) as last_verified_at
          from province_sources p
          left join duty_records dr on dr.province_id = p.id
          group by p.id
        )
        select
          count(*) filter (where pu.last_verified_at > now() - interval '24 hour')::text as updated_24h,
          count(*)::text as total_with_sources,
          round(
            (count(*) filter (where pu.last_verified_at > now() - interval '24 hour')::numeric / nullif(count(*), 0)) * 100, 2
          )::text as coverage_ratio
        from province_updates pu
        `
      );

      const conflicts = await this.db.query<ConflictRow>(
        `
        select
          count(*) filter (where dc.created_at > now() - interval '24 hour')::text as conflicts_24h,
          (
            select count(*)::text
            from duty_records dr
            where dr.last_verified_at > now() - interval '24 hour'
          ) as verified_24h,
          round(
            (
              count(*) filter (where dc.created_at > now() - interval '24 hour')::numeric
              /
              nullif(
                (
                  select count(*)::numeric
                  from duty_records dr
                  where dr.last_verified_at > now() - interval '24 hour'
                ),
                0
              )
            ) * 100, 2
          )::text as conflict_ratio
        from duty_conflicts dc
        `
      );

      return {
        api_cache: this.apiMetrics.snapshot(),
        parser_health: parserRows.rows.map((row) => ({
          il: row.il,
          parser_key: row.parser_key,
          total_runs: Number(row.total_runs),
          failed_runs: Number(row.failed_runs),
          parser_error_rate_pct: Number(row.parser_error_rate || 0)
        })),
        update_coverage: {
          updated_24h: Number(coverage.rows[0]?.updated_24h ?? 0),
          total_with_sources: Number(coverage.rows[0]?.total_with_sources ?? 0),
          coverage_ratio_pct: Number(coverage.rows[0]?.coverage_ratio ?? 0)
        },
        conflict_rate: {
          conflicts_24h: Number(conflicts.rows[0]?.conflicts_24h ?? 0),
          verified_24h: Number(conflicts.rows[0]?.verified_24h ?? 0),
          conflict_ratio_pct: Number(conflicts.rows[0]?.conflict_ratio ?? 0)
        },
        generated_at: new Date().toISOString()
      };
    } catch (error) {
      return {
        api_cache: this.apiMetrics.snapshot(),
        unavailable: true,
        message: error instanceof Error ? error.message : "metrics_unavailable",
        generated_at: new Date().toISOString()
      };
    }
  }

  async openAlerts() {
    try {
      const rows = await this.db.query<AlertRow>(
        `
        select
          ia.id::text as id,
          p.slug as il,
          ia.source_endpoint_id::text as source_endpoint_id,
          ia.alert_type,
          ia.severity,
          ia.message,
          ia.payload,
          ia.created_at::text,
          ia.resolved_at::text
        from ingestion_alerts ia
        join provinces p on p.id = ia.province_id
        where ia.resolved_at is null
        order by ia.created_at desc
        limit 200
        `
      );

      return rows.rows.map((row) => ({
        id: Number(row.id),
        il: row.il,
        source_endpoint_id: row.source_endpoint_id ? Number(row.source_endpoint_id) : null,
        alert_type: row.alert_type,
        severity: row.severity,
        message: row.message,
        payload: row.payload ?? null,
        created_at: row.created_at
      }));
    } catch {
      return [];
    }
  }

  async resolveAlert(alertId: number, resolvedBy: string) {
    try {
      const result = await this.db.query<{ id: string }>(
        `
        update ingestion_alerts
        set resolved_at = now(),
            payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('resolved_by', $2)
        where id = $1
          and resolved_at is null
        returning id::text
        `,
        [alertId, resolvedBy]
      );

      return {
        resolved: (result.rowCount ?? 0) > 0,
        id: alertId
      };
    } catch {
      return {
        resolved: false,
        id: alertId
      };
    }
  }

  async manualOverride(input: ManualOverrideDto) {
    const ilSlug = toSlug(input.il);
    const ilceSlug = toSlug(input.ilce);
    const normalizedName = normalizePharmacyName(input.eczane_adi);
    const { dutyDate } = resolveActiveDutyWindow();
    const selectedDutyDate = input.duty_date ?? dutyDate;
    const dutyBounds = this.resolveDutyBounds(selectedDutyDate);
    const updatedBy = input.updated_by ?? "admin";
    const phone = input.telefon.replace(/[^\d+]/g, "");

    const province = await this.db.query<QueryResultRow & { id: number; name: string }>(
      `select id, name from provinces where slug = $1`,
      [ilSlug]
    );
    if (!province.rowCount) {
      throw new BadRequestException("Unknown province");
    }

    await this.db.withClient(async (client) => {
      await client.query("begin");
      try {
        const district = await client.query<QueryResultRow & { id: number }>(
          `
          insert into districts (province_id, name, slug)
          values ($1, $2, $3)
          on conflict (province_id, slug) do update set name = excluded.name
          returning id
          `,
          [province.rows[0].id, input.ilce, ilceSlug]
        );

        const source = await client.query<QueryResultRow & { id: number }>(
          `
          insert into sources (province_id, name, type, authority_weight, base_url, enabled)
          values ($1, 'Manual Override', 'manual', 100, 'admin://manual-override', true)
          on conflict (province_id, name) do update set
            type = excluded.type,
            authority_weight = excluded.authority_weight,
            enabled = true
          returning id
          `,
          [province.rows[0].id]
        );

        const pharmacy = await client.query<QueryResultRow & { id: string }>(
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
            is_active = true,
            updated_at = now()
          returning id::text
          `,
          [
            province.rows[0].id,
            district.rows[0].id,
            input.eczane_adi,
            normalizedName,
            input.adres,
            phone,
            input.lat ?? null,
            input.lng ?? null
          ]
        );

        const duty = await client.query<QueryResultRow & { id: string }>(
          `
          insert into duty_records (
            pharmacy_id, province_id, district_id, duty_date, duty_start, duty_end, confidence_score,
            verification_source_count, last_verified_at, is_degraded
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
            pharmacy.rows[0].id,
            province.rows[0].id,
            district.rows[0].id,
            selectedDutyDate,
            dutyBounds.startIso,
            dutyBounds.endIso,
            input.dogruluk_puani ?? 100,
            input.dogrulama_kaynagi_sayisi ?? 1,
            input.is_degraded ?? false
          ]
        );

        await client.query(
          `
          insert into duty_evidence (duty_record_id, source_id, source_url, extracted_payload)
          values ($1, $2, 'admin://manual-override', $3::jsonb)
          on conflict (duty_record_id, source_id, source_url) do update set
            seen_at = now(),
            extracted_payload = excluded.extracted_payload
          `,
          [
            duty.rows[0].id,
            source.rows[0].id,
            JSON.stringify({
              manual_override: true,
              updated_by: updatedBy,
              note: input.source_note ?? null,
              timestamp: new Date().toISOString()
            })
          ]
        );

        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });

    await this.deleteByPattern(`api:duty:${ilSlug}:*`);
    await this.deleteByPattern("api:nearest:*");

    return {
      status: "ok",
      il: ilSlug,
      ilce: ilceSlug,
      eczane_adi: input.eczane_adi,
      duty_date: selectedDutyDate,
      updated_by: updatedBy
    };
  }

  private resolveDutyBounds(dutyDate: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dutyDate);
    if (!match) {
      throw new BadRequestException("duty_date must be YYYY-MM-DD");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    // Europe/Istanbul is UTC+3 year-round. 18:00 local => 15:00 UTC, 08:00 next day => 05:00 UTC.
    const start = new Date(Date.UTC(year, month - 1, day, 15, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0, 0));

    return {
      startIso: start.toISOString(),
      endIso: end.toISOString()
    };
  }

  private async deleteByPattern(pattern: string) {
    let cursor = "0";
    do {
      const result = await this.redis.raw.scan(cursor, "MATCH", pattern, "COUNT", "200");
      cursor = result[0];
      const keys = result[1];
      if (keys.length) {
        await this.redis.raw.del(...keys);
      }
    } while (cursor !== "0");
  }
}
