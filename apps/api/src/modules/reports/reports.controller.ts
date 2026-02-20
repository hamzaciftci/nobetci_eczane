import { Body, Controller, Post } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { CreateReportDto } from "./create-report.dto";

@Controller("api/yanlis-bilgi")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  async create(@Body() body: CreateReportDto) {
    return this.reportsService.create(body);
  }
}
