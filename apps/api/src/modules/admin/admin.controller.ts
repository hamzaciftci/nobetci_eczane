import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { RecoveryService } from "./recovery.service";
import { AdminTokenGuard } from "./admin-token.guard";
import { ManualOverrideDto } from "./manual-override.dto";

@UseGuards(AdminTokenGuard)
@Controller("api/admin/ingestion")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly recoveryService: RecoveryService
  ) {}

  @Get("metrics")
  async metrics() {
    return this.adminService.ingestionMetrics();
  }

  @Get("overview")
  async overview() {
    return this.adminService.ingestionOverview();
  }

  @Get("alerts/open")
  async openAlerts() {
    return this.adminService.openAlerts();
  }

  @Post("alerts/:id/resolve")
  async resolveAlert(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { resolved_by?: string }
  ) {
    return this.adminService.resolveAlert(id, body.resolved_by ?? "admin");
  }

  @Post("recovery/:il/trigger")
  async triggerRecovery(@Param("il") il: string) {
    return this.recoveryService.triggerProvincePull(il);
  }

  @Post("manual-override")
  async manualOverride(@Body() body: ManualOverrideDto) {
    return this.adminService.manualOverride(body);
  }

  @Get(":il")
  async byProvince(@Param("il") il: string) {
    return this.adminService.ingestionByProvince(il);
  }
}
