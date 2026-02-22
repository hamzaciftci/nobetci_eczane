import { Injectable } from "@nestjs/common";
import { QueryResultRow } from "pg";
import { DatabaseService } from "../../infra/database.service";
import { IngestionQueueService } from "../../infra/ingestion-queue.service";

@Injectable()
export class CronService {
  constructor(
    private readonly db: DatabaseService,
    private readonly queue: IngestionQueueService
  ) {}

  async triggerFullSync() {
    return this.queue.enqueueFullSync("cron_full_sync");
  }

  async triggerValidateAll() {
    const provinces = await this.listActiveProvinces();
    const results = await Promise.all(
      provinces.map(async (provinceSlug) => ({
        province: provinceSlug,
        result: await this.queue.enqueueProvincePull(provinceSlug, "cron_validate_all")
      }))
    );

    return {
      queued_count: results.filter((item) => item.result.queued).length,
      total_provinces: provinces.length,
      results
    };
  }

  async triggerValidateProvince(provinceSlug: string) {
    const result = await this.queue.enqueueProvincePull(provinceSlug, "cron_validate_single");
    return {
      province: provinceSlug,
      ...result
    };
  }

  private async listActiveProvinces(): Promise<string[]> {
    const rows = await this.db.query<QueryResultRow & { slug: string }>(
      `
      select distinct p.slug
      from provinces p
      join sources s on s.province_id = p.id and s.enabled = true
      join source_endpoints se on se.source_id = s.id and se.enabled = true
      order by p.slug asc
      `
    );

    return rows.rows.map((row) => row.slug).filter(Boolean);
  }
}
