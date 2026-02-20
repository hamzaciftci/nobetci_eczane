import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../infra/database.service";
import { RedisService } from "../../infra/redis.service";

@Injectable()
export class HealthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService
  ) {}

  async readiness() {
    const startedAt = Date.now();
    const checks = {
      postgres: false,
      redis: false
    };

    try {
      await this.db.query("select 1 as ok");
      checks.postgres = true;
    } catch {
      checks.postgres = false;
    }

    try {
      await this.redis.raw.ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    }

    const ok = checks.postgres && checks.redis;
    return {
      status: ok ? "ok" : "degraded",
      checks,
      latency_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    };
  }
}
