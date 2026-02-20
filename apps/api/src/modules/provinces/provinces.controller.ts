import { Controller, Get } from "@nestjs/common";
import { ProvincesService } from "./provinces.service";

@Controller("api/iller")
export class ProvincesController {
  constructor(private readonly provincesService: ProvincesService) {}

  @Get()
  async list() {
    return this.provincesService.list();
  }
}
