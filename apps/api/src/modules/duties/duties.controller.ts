import { Controller, Get, Param, Query } from "@nestjs/common";
import { DutiesService } from "./duties.service";

@Controller("api/il")
export class DutiesController {
  constructor(private readonly dutiesService: DutiesService) {}

  @Get(":il/nobetci")
  async byProvince(@Param("il") il: string, @Query("date") date?: string) {
    return this.dutiesService.byProvince(il, date);
  }

  @Get(":il/:ilce/nobetci")
  async byDistrict(@Param("il") il: string, @Param("ilce") ilce: string, @Query("date") date?: string) {
    return this.dutiesService.byDistrict(il, ilce, date);
  }
}
