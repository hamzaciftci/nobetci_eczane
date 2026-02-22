import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { DutiesController } from "./duties.controller";
import { DutiesService } from "./duties.service";
import { RealtimeOverrideController } from "./realtime-override.controller";
import { RealtimeOverrideService } from "./realtime-override.service";

@Module({
  imports: [AdminModule],
  controllers: [DutiesController, RealtimeOverrideController],
  providers: [DutiesService, RealtimeOverrideService],
  exports: [DutiesService]
})
export class DutiesModule {}
