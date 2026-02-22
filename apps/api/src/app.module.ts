import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { join } from "path";
import { InfraModule } from "./infra/infra.module";
import { envValue } from "./infra/env.util";
import { ProvincesModule } from "./modules/provinces/provinces.module";
import { DutiesModule } from "./modules/duties/duties.module";
import { NearestModule } from "./modules/nearest/nearest.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { HealthModule } from "./modules/health/health.module";
import { AdminModule } from "./modules/admin/admin.module";
import { CronModule } from "./modules/cron/cron.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(process.cwd(), ".env"), join(process.cwd(), "../../.env")]
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(envValue(process.env.RATE_LIMIT_TTL) ?? 60000),
        limit: Number(envValue(process.env.RATE_LIMIT_LIMIT) ?? 120)
      }
    ]),
    InfraModule,
    ProvincesModule,
    DutiesModule,
    NearestModule,
    ReportsModule,
    HealthModule,
    AdminModule,
    CronModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
