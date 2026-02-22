import { Injectable, Logger } from "@nestjs/common";
import { QueryResultRow } from "pg";
import { DatabaseService } from "../../infra/database.service";
import { IngestionQueueService } from "../../infra/ingestion-queue.service";
import { RedisService } from "../../infra/redis.service";

type TimestampRow = QueryResultRow & {
  last_update: string | null;
};

@Injectable()
export class RealtimeOverrideService {
  private readonly logger = new Logger(RealtimeOverrideService.name);
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly staleHours = resolveStaleHours();
  private readonly waitTimeoutMs = resolveWaitTimeoutMs();

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly queue: IngestionQueueService
  ) {}

  async ensureProvinceFresh(provinceSlug: string, dutyDate: string): Promise<void> {
    const lastUpdate = await this.getLatestProvinceUpdate(provinceSlug, dutyDate);
    if (!lastUpdate) {
      return;
    }

    const ageMs = Date.now() - new Date(lastUpdate).getTime();
    if (!Number.isFinite(ageMs) || ageMs < this.staleHours * 60 * 60 * 1000) {
      return;
    }

    await this.refreshProvinceWithLock(provinceSlug, dutyDate, "stale_auto_refresh");
  }

  async forceRefreshProvince(provinceSlug: string, dutyDate: string) {
    await this.refreshProvinceWithLock(provinceSlug, dutyDate, "manual_force_refresh");
    return {
      province: provinceSlug,
      duty_date: dutyDate,
      status: "queued_or_refreshed"
    };
  }

  private async refreshProvinceWithLock(provinceSlug: string, dutyDate: string, reason: string) {
    const lockKey = `${provinceSlug}:${dutyDate}`;
    const existing = this.inFlight.get(lockKey);
    if (existing) {
      await existing;
      return;
    }

    const run = this.refreshProvince(provinceSlug, dutyDate, reason);
    this.inFlight.set(lockKey, run);

    try {
      await run;
    } finally {
      this.inFlight.delete(lockKey);
    }
  }

  private async refreshProvince(provinceSlug: string, dutyDate: string, reason: string) {
    const beforeRefresh = await this.getLatestDutyRecordUpdate(provinceSlug, dutyDate);
    const queueResult = await this.queue.enqueueProvincePull(provinceSlug, reason);

    if (!queueResult.queued) {
      await this.enqueueRetry(provinceSlug, `queue_unavailable:${reason}`);
      return;
    }

    const refreshed = await this.waitUntilUpdated(provinceSlug, dutyDate, beforeRefresh);
    if (!refreshed) {
      await this.enqueueRetry(provinceSlug, `refresh_timeout:${reason}`);
      return;
    }

    await this.invalidateDutyCache(provinceSlug);
    this.logger.log(`Realtime override applied for ${provinceSlug} (${dutyDate})`);
  }

  private async waitUntilUpdated(
    provinceSlug: string,
    dutyDate: string,
    beforeRefreshIso: string | null
  ): Promise<boolean> {
    const started = Date.now();
    const baseTs = beforeRefreshIso ? new Date(beforeRefreshIso).getTime() : 0;

    while (Date.now() - started < this.waitTimeoutMs) {
      await delay(2000);
      const nowIso = await this.getLatestDutyRecordUpdate(provinceSlug, dutyDate);
      if (!nowIso) {
        continue;
      }
      const nowTs = new Date(nowIso).getTime();
      if (!Number.isFinite(nowTs)) {
        continue;
      }
      if (nowTs > baseTs) {
        return true;
      }
    }

    return false;
  }

  private async getLatestProvinceUpdate(provinceSlug: string, dutyDate: string): Promise<string | null> {
    const snapshot = await this.db.query<TimestampRow>(
      `
      select max(updated_at)::text as last_update
      from duty_pharmacies
      where province_slug = $1
        and duty_date = $2::date
      `,
      [provinceSlug, dutyDate]
    );

    const fromSnapshot = snapshot.rows[0]?.last_update ?? null;
    if (fromSnapshot) {
      return fromSnapshot;
    }

    return this.getLatestDutyRecordUpdate(provinceSlug, dutyDate);
  }

  private async getLatestDutyRecordUpdate(provinceSlug: string, dutyDate: string): Promise<string | null> {
    const rows = await this.db.query<TimestampRow>(
      `
      select max(dr.last_verified_at)::text as last_update
      from duty_records dr
      join provinces p on p.id = dr.province_id
      where p.slug = $1
        and dr.duty_date = $2::date
      `,
      [provinceSlug, dutyDate]
    );

    return rows.rows[0]?.last_update ?? null;
  }

  private async enqueueRetry(provinceSlug: string, reason: string) {
    try {
      await this.db.query(
        `
        insert into ingestion_retry_queue (
          province_slug,
          reason,
          payload,
          retry_count,
          next_retry_at,
          status,
          created_at,
          updated_at
        )
        values ($1, $2, '{}'::jsonb, 0, now() + interval '5 minute', 'pending', now(), now())
        `,
        [provinceSlug, reason]
      );
    } catch (error) {
      this.logger.warn(`Failed to enqueue retry for ${provinceSlug}: ${String(error)}`);
    }
  }

  private async invalidateDutyCache(provinceSlug: string) {
    await this.deleteByPattern(`api:duty:${provinceSlug}:*`);
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

function resolveStaleHours(): number {
  const value = Number(process.env.REALTIME_OVERRIDE_STALE_HOURS ?? 6);
  if (!Number.isFinite(value) || value <= 0) {
    return 6;
  }
  return Math.min(24, value);
}

function resolveWaitTimeoutMs(): number {
  const value = Number(process.env.REALTIME_OVERRIDE_WAIT_MS ?? 20000);
  if (!Number.isFinite(value) || value <= 0) {
    return 20000;
  }
  return Math.min(120000, value);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
