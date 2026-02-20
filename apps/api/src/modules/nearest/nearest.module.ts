import { Module } from "@nestjs/common";
import { NearestController } from "./nearest.controller";
import { NearestService } from "./nearest.service";

@Module({
  controllers: [NearestController],
  providers: [NearestService]
})
export class NearestModule {}
