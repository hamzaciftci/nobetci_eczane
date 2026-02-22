import { BadRequestException, Injectable } from "@nestjs/common";
import { DutyRecordDto, resolveActiveDutyWindow } from "../../shared";
import { QueryResultRow } from "pg";
import { ApiMetricsService } from "../../infra/api-metrics.service";
import { DatabaseService } from "../../infra/database.service";
import { RedisService } from "../../infra/redis.service";
import { RealtimeOverrideService } from "./realtime-override.service";

type DutyRow = QueryResultRow & {
  eczane_adi: string;
  il: string;
  ilce: string;
  adres: string;
  telefon: string;
  nobet_saatleri: string | null;
  lat: string | null;
  lng: string | null;
  kaynak: string;
  kaynak_url: string;
  son_guncelleme: string | Date;
  dogruluk_puani: string;
  dogrulama_kaynagi_sayisi: number;
  is_degraded: boolean;
};

type DutyUpdateRow = QueryResultRow & {
  last_verified_at: string | null;
};

type DutyDateRow = QueryResultRow & {
  duty_date: string;
};

type DegradedState = {
  last_successful_update: string | null;
  stale_minutes: number | null;
  recent_alert: string | null;
};

type DutyResponse = {
  status: "ok" | "degraded";
  duty_date: string;
  available_dates: string[];
  son_guncelleme: string | null;
  degraded_info: {
    last_successful_update: string | null;
    stale_minutes: number | null;
    recent_alert: string | null;
    hint: string;
  } | null;
  data: DutyRecordDto[];
};

const MAX_DUTY_TTL_SECONDS = 600;
const DUTY_TTL_SECONDS = resolveDutyTtl();
const DUTY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class DutiesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly apiMetrics: ApiMetricsService,
    private readonly realtimeOverride: RealtimeOverrideService
  ) {}

  async byProvince(ilSlug: string, requestedDate?: string) {
    this.apiMetrics.trackEndpoint("/api/il/:il/nobetci");
    const dutyDate = this.resolveRequestedDutyDate(requestedDate);
    await this.realtimeOverride.ensureProvinceFresh(ilSlug, dutyDate);
    const cacheKey = `api:duty:${ilSlug}:all:${dutyDate}`;

    const cached = await this.redis.getJson<DutyResponse>(cacheKey);
    if (cached) {
      const hasNewer = await this.hasNewerProvinceUpdate(ilSlug, dutyDate, cached.son_guncelleme);
      if (!hasNewer) {
        this.apiMetrics.trackCacheHit();
        return cached;
      }
    }
    this.apiMetrics.trackCacheMiss();

    const query = await this.queryDutyRowsByProvince(ilSlug, dutyDate);
    const degraded = await this.getDegradedInfo(ilSlug);
    const availableDates = await this.listAvailableDates(ilSlug);
    const payload = this.toResponse(query.rows, degraded, dutyDate, availableDates);
    await this.redis.setJson(cacheKey, payload, DUTY_TTL_SECONDS);
    return payload;
  }

  async byDistrict(ilSlug: string, ilceSlug: string, requestedDate?: string) {
    this.apiMetrics.trackEndpoint("/api/il/:il/:ilce/nobetci");
    const dutyDate = this.resolveRequestedDutyDate(requestedDate);
    await this.realtimeOverride.ensureProvinceFresh(ilSlug, dutyDate);
    const cacheKey = `api:duty:${ilSlug}:${ilceSlug}:${dutyDate}`;

    const cached = await this.redis.getJson<DutyResponse>(cacheKey);
    if (cached) {
      const hasNewer = await this.hasNewerProvinceUpdate(ilSlug, dutyDate, cached.son_guncelleme);
      if (!hasNewer) {
        this.apiMetrics.trackCacheHit();
        return cached;
      }
    }
    this.apiMetrics.trackCacheMiss();

    const query = await this.queryDutyRowsByDistrict(ilSlug, ilceSlug, dutyDate);
    const degraded = await this.getDegradedInfo(ilSlug);
    const availableDates = await this.listAvailableDates(ilSlug, ilceSlug);
    const payload = this.toResponse(query.rows, degraded, dutyDate, availableDates);
    await this.redis.setJson(cacheKey, payload, DUTY_TTL_SECONDS);
    return payload;
  }

  private resolveRequestedDutyDate(value?: string): string {
    const fallback = resolveActiveDutyWindow().dutyDate;
    const cleaned = (value ?? "").trim();
    if (!cleaned) {
      return fallback;
    }

    if (!DUTY_DATE_PATTERN.test(cleaned)) {
      throw new BadRequestException("date must be YYYY-MM-DD");
    }

    return cleaned;
  }

  private async queryDutyRowsByProvince(ilSlug: string, dutyDate: string) {
    return this.db.query<DutyRow>(
      `
      select
        ph.canonical_name as eczane_adi,
        pr.name as il,
        d.name as ilce,
        ph.address as adres,
        ph.phone as telefon,
        to_char(dr.duty_start at time zone 'Europe/Istanbul', 'HH24:MI')
          || '-' ||
        to_char(dr.duty_end at time zone 'Europe/Istanbul', 'HH24:MI') as nobet_saatleri,
        ph.lat::text as lat,
        ph.lng::text as lng,
        string_agg(distinct s.name, ', ') as kaynak,
        min(de.source_url) as kaynak_url,
        max(dr.last_verified_at) as son_guncelleme,
        dr.confidence_score::text as dogruluk_puani,
        dr.verification_source_count as dogrulama_kaynagi_sayisi,
        dr.is_degraded
      from duty_records dr
      join pharmacies ph on ph.id = dr.pharmacy_id
      join provinces pr on pr.id = dr.province_id
      join districts d on d.id = dr.district_id
      join duty_evidence de on de.duty_record_id = dr.id
      join sources s on s.id = de.source_id
      where pr.slug = $1
        and dr.duty_date = $2
      group by
        dr.id,
        ph.canonical_name,
        pr.name,
        d.name,
        ph.address,
        ph.phone,
        ph.lat,
        ph.lng,
        dr.confidence_score,
        dr.verification_source_count,
        dr.is_degraded
      order by d.name asc, ph.canonical_name asc
      `,
      [ilSlug, dutyDate]
    );
  }

  private async queryDutyRowsByDistrict(ilSlug: string, ilceSlug: string, dutyDate: string) {
    return this.db.query<DutyRow>(
      `
      select
        ph.canonical_name as eczane_adi,
        pr.name as il,
        d.name as ilce,
        ph.address as adres,
        ph.phone as telefon,
        to_char(dr.duty_start at time zone 'Europe/Istanbul', 'HH24:MI')
          || '-' ||
        to_char(dr.duty_end at time zone 'Europe/Istanbul', 'HH24:MI') as nobet_saatleri,
        ph.lat::text as lat,
        ph.lng::text as lng,
        string_agg(distinct s.name, ', ') as kaynak,
        min(de.source_url) as kaynak_url,
        max(dr.last_verified_at) as son_guncelleme,
        dr.confidence_score::text as dogruluk_puani,
        dr.verification_source_count as dogrulama_kaynagi_sayisi,
        dr.is_degraded
      from duty_records dr
      join pharmacies ph on ph.id = dr.pharmacy_id
      join provinces pr on pr.id = dr.province_id
      join districts d on d.id = dr.district_id
      join duty_evidence de on de.duty_record_id = dr.id
      join sources s on s.id = de.source_id
      where pr.slug = $1
        and d.slug = $2
        and dr.duty_date = $3
      group by
        dr.id,
        ph.canonical_name,
        pr.name,
        d.name,
        ph.address,
        ph.phone,
        ph.lat,
        ph.lng,
        dr.confidence_score,
        dr.verification_source_count,
        dr.is_degraded
      order by ph.canonical_name asc
      `,
      [ilSlug, ilceSlug, dutyDate]
    );
  }

  private async listAvailableDates(ilSlug: string, ilceSlug?: string): Promise<string[]> {
    const params: string[] = [ilSlug];
    const districtCondition = ilceSlug ? "and d.slug = $2" : "";
    if (ilceSlug) {
      params.push(ilceSlug);
    }

    const query = await this.db.query<DutyDateRow>(
      `
      select distinct dr.duty_date::text as duty_date
      from duty_records dr
      join provinces p on p.id = dr.province_id
      join districts d on d.id = dr.district_id
      where p.slug = $1
        ${districtCondition}
        and dr.duty_date >= (now() at time zone 'Europe/Istanbul')::date
        and dr.duty_date <= ((now() at time zone 'Europe/Istanbul')::date + interval '14 day')
      order by dr.duty_date asc
      `,
      params
    );

    return query.rows.map((row) => row.duty_date).filter(Boolean);
  }

  private async hasNewerProvinceUpdate(
    ilSlug: string,
    dutyDate: string,
    cachedLatestIso: string | null
  ): Promise<boolean> {
    if (!cachedLatestIso) {
      return true;
    }

    const latest = await this.db.query<DutyUpdateRow>(
      `
      select max(dr.last_verified_at)::text as last_verified_at
      from duty_records dr
      join provinces p on p.id = dr.province_id
      where p.slug = $1 and dr.duty_date = $2
      `,
      [ilSlug, dutyDate]
    );

    const dbLatestIso = latest.rows[0]?.last_verified_at ?? null;
    if (!dbLatestIso) {
      return false;
    }

    return new Date(dbLatestIso).getTime() > new Date(cachedLatestIso).getTime();
  }

  private toResponse(
    rows: DutyRow[],
    degraded: DegradedState,
    dutyDate: string,
    availableDates: string[]
  ): DutyResponse {
    const data = rows.map<DutyRecordDto>((row) => ({
      eczane_adi: row.eczane_adi,
      il: row.il,
      ilce: row.ilce,
      adres: row.adres,
      telefon: row.telefon,
      nobet_saatleri: row.nobet_saatleri ?? null,
      lat: row.lat ? Number(row.lat) : null,
      lng: row.lng ? Number(row.lng) : null,
      kaynak: row.kaynak,
      kaynak_url: row.kaynak_url,
      son_guncelleme: toIso(row.son_guncelleme),
      dogruluk_puani: Number(row.dogruluk_puani),
      dogrulama_kaynagi_sayisi: row.dogrulama_kaynagi_sayisi,
      is_degraded: row.is_degraded
    }));

    const latest = rows
      .map((r) => new Date(r.son_guncelleme).getTime())
      .reduce((max, current) => Math.max(max, current), 0);

    const computedLatest = latest ? new Date(latest).toISOString() : degraded.last_successful_update;
    const staleDegraded = degraded.stale_minutes !== null && degraded.stale_minutes > 30;
    const flagDegraded = rows.some((r) => r.is_degraded);
    const status: "ok" | "degraded" = flagDegraded || (rows.length === 0 && staleDegraded) ? "degraded" : "ok";

    return {
      status,
      duty_date: dutyDate,
      available_dates: [...new Set([...(availableDates ?? []), dutyDate])].sort(),
      son_guncelleme: computedLatest,
      degraded_info:
        status === "degraded"
          ? {
              last_successful_update: degraded.last_successful_update,
              stale_minutes: degraded.stale_minutes,
              recent_alert: degraded.recent_alert,
              hint: "Kaynaklar yenileniyor. Biraz sonra tekrar kontrol edin."
            }
          : null,
      data
    };
  }

  private async getDegradedInfo(ilSlug: string): Promise<DegradedState> {
    let lastSuccessfulUpdate: string | null = null;
    let staleMinutes: number | null = null;
    let recentAlert: string | null = null;

    try {
      const summary = await this.db.query<
        QueryResultRow & { last_successful_update: string | null; stale_minutes: string | null }
      >(
        `
        select
          max(dr.last_verified_at)::text as last_successful_update,
          round(extract(epoch from (now() - max(dr.last_verified_at))) / 60.0, 2)::text as stale_minutes
        from provinces p
        left join duty_records dr on dr.province_id = p.id
        where p.slug = $1
        group by p.id
        `,
        [ilSlug]
      );
      lastSuccessfulUpdate = summary.rows[0]?.last_successful_update ?? null;
      staleMinutes = parseFloatOrNull(summary.rows[0]?.stale_minutes ?? null);
    } catch {
      // Leave summary values as null when query fails.
    }

    try {
      const alert = await this.db.query<QueryResultRow & { message: string }>(
        `
        select ia.message
        from ingestion_alerts ia
        join provinces p on p.id = ia.province_id
        where p.slug = $1
        order by ia.created_at desc
        limit 1
        `,
        [ilSlug]
      );
      recentAlert = alert.rows[0]?.message ?? null;
    } catch {
      // Old DB may not have ingestion_alerts table yet.
    }

    return {
      last_successful_update: lastSuccessfulUpdate,
      stale_minutes: staleMinutes,
      recent_alert: recentAlert
    };
  }
}

function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

function parseFloatOrNull(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveDutyTtl(): number {
  const configured = Number(process.env.DUTY_CACHE_TTL_SECONDS ?? MAX_DUTY_TTL_SECONDS);
  if (!Number.isFinite(configured) || configured <= 0) {
    return MAX_DUTY_TTL_SECONDS;
  }
  return Math.min(Math.round(configured), MAX_DUTY_TTL_SECONDS);
}
