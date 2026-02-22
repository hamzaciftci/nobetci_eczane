import { Controller, ForbiddenException, Get, Headers, Param, Post } from "@nestjs/common";
import { CronService } from "./cron.service";

@Controller("api/cron")
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Get("full-sync")
  async fullSyncGet(
    @Headers("x-cron-token") cronToken?: string,
    @Headers("authorization") authorization?: string
  ) {
    this.assertToken(cronToken, authorization);
    return this.cronService.triggerFullSync();
  }

  @Post("full-sync")
  async fullSyncPost(
    @Headers("x-cron-token") cronToken?: string,
    @Headers("authorization") authorization?: string
  ) {
    this.assertToken(cronToken, authorization);
    return this.cronService.triggerFullSync();
  }

  @Get("validate-all")
  async validateAllGet(
    @Headers("x-cron-token") cronToken?: string,
    @Headers("authorization") authorization?: string
  ) {
    this.assertToken(cronToken, authorization);
    return this.cronService.triggerValidateAll();
  }

  @Post("validate-all")
  async validateAllPost(
    @Headers("x-cron-token") cronToken?: string,
    @Headers("authorization") authorization?: string
  ) {
    this.assertToken(cronToken, authorization);
    return this.cronService.triggerValidateAll();
  }

  @Get("validate/:il")
  async validateProvinceGet(
    @Param("il") il: string,
    @Headers("x-cron-token") cronToken?: string,
    @Headers("authorization") authorization?: string
  ) {
    this.assertToken(cronToken, authorization);
    return this.cronService.triggerValidateProvince(il);
  }

  @Post("validate/:il")
  async validateProvincePost(
    @Param("il") il: string,
    @Headers("x-cron-token") cronToken?: string,
    @Headers("authorization") authorization?: string
  ) {
    this.assertToken(cronToken, authorization);
    return this.cronService.triggerValidateProvince(il);
  }

  private assertToken(cronToken?: string, authorization?: string) {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      return;
    }

    const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : undefined;
    if (cronToken === expected || bearer === expected) {
      return;
    }

    throw new ForbiddenException("Invalid cron token");
  }
}
