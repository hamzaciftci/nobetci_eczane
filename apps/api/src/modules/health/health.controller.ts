import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller(["health", "api/health"])
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  get() {
    return {
      status: "ok",
      timestamp: new Date().toISOString()
    };
  }

  @Get("ready")
  async ready() {
    return this.healthService.readiness();
  }
}
