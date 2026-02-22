import { Global, Module } from "@nestjs/common";
import { ApiMetricsService } from "./api-metrics.service";
import { DatabaseService } from "./database.service";
import { IngestionQueueService } from "./ingestion-queue.service";
import { RedisService } from "./redis.service";

@Global()
@Module({
  providers: [DatabaseService, RedisService, ApiMetricsService, IngestionQueueService],
  exports: [DatabaseService, RedisService, ApiMetricsService, IngestionQueueService]
})
export class InfraModule {}
