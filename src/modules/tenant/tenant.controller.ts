import { Body, Controller, Get, Patch, Post, Put } from "@nestjs/common";

import { TenantService } from "./tenant.service";

import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantSettingsDto } from "./dto/update-tenant-settings.dto";
import { UpdateBusinessHoursDto } from "./dto/update-business-hours.dto";

import { RequirePermission } from "../../common/decorators/permission.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ApiMessage } from "../../common/decorators/api-message.decorator";

@Controller("tenants")
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @RequirePermission("TENANT_CREATE")
  createTenant(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  @Get("settings")
  @ApiMessage("Tenant settings fetched successfully")
  getSettings(@CurrentUser() user: any) {
    return this.tenantService.getSettings(user.tenantId);
  }

  @Patch("settings")
  @ApiMessage("Tenant settings updated successfully")
  updateSettings(
    @Body() dto: UpdateTenantSettingsDto,
    @CurrentUser() user: any,
  ) {
    return this.tenantService.updateSettings(user.tenantId, dto);
  }

  @Get("business-hours")
  @ApiMessage("Tenant business hours fetched successfully")
  getBusinessHours(@CurrentUser() user: any) {
    return this.tenantService.getBusinessHours(user.tenantId);
  }

  @Put("business-hours")
  @ApiMessage("Tenant business hours updated successfully")
  updateBusinessHours(
    @Body() dto: UpdateBusinessHoursDto,
    @CurrentUser() user: any,
  ) {
    return this.tenantService.updateBusinessHours(user.tenantId, dto.hours);
  }
}
