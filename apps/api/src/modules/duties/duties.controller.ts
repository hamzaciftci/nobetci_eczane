import { Controller, Get, Param } from "@nestjs/common";
import { DutiesService } from "./duties.service";

@Controller("api/il")
export class DutiesController {
  constructor(private readonly dutiesService: DutiesService) {}

  @Get(":il/nobetci")
  async byProvince(@Param("il") il: string) {
    return this.dutiesService.byProvince(il);
  }

  @Get(":il/:ilce/nobetci")
  async byDistrict(@Param("il") il: string, @Param("ilce") ilce: string) {
    return this.dutiesService.byDistrict(il, ilce);
  }
}
