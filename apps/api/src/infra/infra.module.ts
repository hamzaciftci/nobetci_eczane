import { Global, Module } from "@nestjs/common";
import { ApiMetricsService } from "./api-metrics.service";
import { DatabaseService } from "./database.service";
import { RedisService } from "./redis.service";

@Global()
@Module({
  providers: [DatabaseService, RedisService, ApiMetricsService],
  exports: [DatabaseService, RedisService, ApiMetricsService]
})
export class InfraModule {}
