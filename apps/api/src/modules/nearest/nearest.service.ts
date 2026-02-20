import { Injectable } from "@nestjs/common";
import { resolveActiveDutyWindow } from "../../shared";
import { QueryResultRow } from "pg";
import { ApiMetricsService } from "../../infra/api-metrics.service";
import { DatabaseService } from "../../infra/database.service";
import { RedisService } from "../../infra/redis.service";

type NearestRow = QueryResultRow & {
  eczane_adi: string;
  il: string;
  ilce: string;
  adres: string;
  telefon: string;
  lat: string;
  lng: string;
  kaynak: string;
  kaynak_url: string;
  son_guncelleme: string | Date;
  dogruluk_puani: string;
  dogrulama_kaynagi_sayisi: number;
  is_degraded: boolean;
};

const NEAREST_TTL_SECONDS = 60;

@Injectable()
export class NearestService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly apiMetrics: ApiMetricsService
  ) {}

  async nearest(lat: number, lng: number, limit = 10) {
    this.apiMetrics.trackEndpoint("/api/nearest");
    const { dutyDate } = resolveActiveDutyWindow();
    const cacheKey = `api:nearest:${lat.toFixed(2)}:${lng.toFixed(2)}:${dutyDate}:${limit}`;

    const cached = await this.redis.getJson(cacheKey);
    if (cached) {
      this.apiMetrics.trackCacheHit();
      return cached;
    }
    this.apiMetrics.trackCacheMiss();

    const result = await this.db.query<NearestRow>(
      `
      select
        eczane_adi, il, ilce, adres, telefon, lat, lng, kaynak, kaynak_url,
        son_guncelleme, dogruluk_puani, dogrulama_kaynagi_sayisi, is_degraded
      from api_active_duty
      where lat is not null and lng is not null
      limit 5000
      `
    );

    const sorted = result.rows
      .map((row) => {
        const distanceKm = haversineKm(lat, lng, Number(row.lat), Number(row.lng));
        return {
          ...row,
          distance_km: Number(distanceKm.toFixed(3))
        };
      })
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);

    const payload = {
      status: sorted.some((item) => item.is_degraded) ? "degraded" : "ok",
      data: sorted.map((item) => ({
        eczane_adi: item.eczane_adi,
        il: item.il,
        ilce: item.ilce,
        adres: item.adres,
        telefon: item.telefon,
        lat: Number(item.lat),
        lng: Number(item.lng),
        kaynak: item.kaynak,
        kaynak_url: item.kaynak_url,
        son_guncelleme: new Date(item.son_guncelleme).toISOString(),
        dogruluk_puani: Number(item.dogruluk_puani),
        dogrulama_kaynagi_sayisi: item.dogrulama_kaynagi_sayisi,
        distance_km: item.distance_km
      }))
    };

    await this.redis.setJson(cacheKey, payload, NEAREST_TTL_SECONDS);
    return payload;
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}
