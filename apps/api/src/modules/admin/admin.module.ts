import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { RecoveryService } from "./recovery.service";
import { AdminTokenGuard } from "./admin-token.guard";

@Module({
  controllers: [AdminController],
  providers: [AdminService, RecoveryService, AdminTokenGuard],
  exports: [AdminTokenGuard]
})
export class AdminModule {}
