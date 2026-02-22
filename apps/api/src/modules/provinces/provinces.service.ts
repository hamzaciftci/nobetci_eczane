import { Injectable } from "@nestjs/common";
import { ProvinceDto } from "../../shared";
import { ApiMetricsService } from "../../infra/api-metrics.service";
import { DatabaseService } from "../../infra/database.service";
import { RedisService } from "../../infra/redis.service";

const PROVINCES_CACHE_KEY = "api:iller";
const PROVINCES_CACHE_TTL_SECONDS = 5 * 60;

@Injectable()
export class ProvincesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly apiMetrics: ApiMetricsService
  ) {}

  async list(): Promise<ProvinceDto[]> {
    this.apiMetrics.trackEndpoint("/api/iller");
    const cached = await this.redis.getJson<ProvinceDto[]>(PROVINCES_CACHE_KEY);
    if (cached) {
      this.apiMetrics.trackCacheHit();
      return cached;
    }
    this.apiMetrics.trackCacheMiss();

    const result = await this.db.query<ProvinceDto>(
      `
      select code, name, slug
      from provinces
      order by code asc
      `
    );

    await this.redis.setJson(PROVINCES_CACHE_KEY, result.rows, PROVINCES_CACHE_TTL_SECONDS);
    return result.rows;
  }
}
