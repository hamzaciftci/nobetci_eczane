import { Injectable } from "@nestjs/common";
import { DutyRecordDto, resolveActiveDutyWindow } from "../../shared";
import { QueryResultRow } from "pg";
import { ApiMetricsService } from "../../infra/api-metrics.service";
import { DatabaseService } from "../../infra/database.service";
import { RedisService } from "../../infra/redis.service";

type DutyRow = QueryResultRow & {
  eczane_adi: string;
  il: string;
  ilce: string;
  adres: string;
  telefon: string;
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

type DegradedState = {
  last_successful_update: string | null;
  stale_minutes: number | null;
  recent_alert: string | null;
};

type DutyResponse = {
  status: "ok" | "degraded";
  son_guncelleme: string | null;
  degraded_info: {
    last_successful_update: string | null;
    stale_minutes: number | null;
    recent_alert: string | null;
    hint: string;
  } | null;
  data: DutyRecordDto[];
};

const DUTY_TTL_SECONDS = 120;

@Injectable()
export class DutiesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly apiMetrics: ApiMetricsService
  ) {}

  async byProvince(ilSlug: string) {
    this.apiMetrics.trackEndpoint("/api/il/:il/nobetci");
    const { dutyDate } = resolveActiveDutyWindow();
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

    const query = await this.db.query<DutyRow>(
      `
      select
        eczane_adi, il, ilce, adres, telefon, lat, lng, kaynak, kaynak_url,
        son_guncelleme, dogruluk_puani, dogrulama_kaynagi_sayisi, is_degraded
      from api_active_duty
      where il_slug = $1
      order by ilce asc, eczane_adi asc
      `,
      [ilSlug]
    );

    const degraded = await this.getDegradedInfo(ilSlug);
    const payload = this.toResponse(query.rows, degraded);
    await this.redis.setJson(cacheKey, payload, DUTY_TTL_SECONDS);
    return payload;
  }

  async byDistrict(ilSlug: string, ilceSlug: string) {
    this.apiMetrics.trackEndpoint("/api/il/:il/:ilce/nobetci");
    const { dutyDate } = resolveActiveDutyWindow();
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

    const query = await this.db.query<DutyRow>(
      `
      select
        eczane_adi, il, ilce, adres, telefon, lat, lng, kaynak, kaynak_url,
        son_guncelleme, dogruluk_puani, dogrulama_kaynagi_sayisi, is_degraded
      from api_active_duty
      where il_slug = $1 and ilce_slug = $2
      order by eczane_adi asc
      `,
      [ilSlug, ilceSlug]
    );

    const degraded = await this.getDegradedInfo(ilSlug);
    const payload = this.toResponse(query.rows, degraded);
    await this.redis.setJson(cacheKey, payload, DUTY_TTL_SECONDS);
    return payload;
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

  private toResponse(rows: DutyRow[], degraded: DegradedState): DutyResponse {
    const data = rows.map<DutyRecordDto>((row) => ({
      eczane_adi: row.eczane_adi,
      il: row.il,
      ilce: row.ilce,
      adres: row.adres,
      telefon: row.telefon,
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
