import { Controller, Get, Query } from "@nestjs/common";
import { NearestQueryDto } from "./nearest-query.dto";
import { NearestService } from "./nearest.service";

@Controller("api/nearest")
export class NearestController {
  constructor(private readonly nearestService: NearestService) {}

  @Get()
  async nearest(@Query() query: NearestQueryDto) {
    return this.nearestService.nearest(query.lat, query.lng);
  }
}
