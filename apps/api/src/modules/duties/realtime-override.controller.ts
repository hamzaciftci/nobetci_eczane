import { Controller, Param, Post, Query, UseGuards } from "@nestjs/common";
import { resolveActiveDutyWindow } from "../../shared";
import { AdminTokenGuard } from "../admin/admin-token.guard";
import { RealtimeOverrideService } from "./realtime-override.service";

@UseGuards(AdminTokenGuard)
@Controller("api/realtime-override")
export class RealtimeOverrideController {
  constructor(private readonly realtimeOverride: RealtimeOverrideService) {}

  @Post(":il/refresh")
  async refreshProvince(@Param("il") il: string, @Query("date") date?: string) {
    const dutyDate = date?.trim() || resolveActiveDutyWindow().dutyDate;
    return this.realtimeOverride.forceRefreshProvince(il, dutyDate);
  }
}
