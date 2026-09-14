import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { AdminService } from './admin.service';
import {
  UpdateTenantStatusDto,
  ImpersonateTenantDto,
  CreatePlanDto,
  UpdatePlanDto,
  UpdateTenantSubscriptionDto,
  CreateTenantDto,
  UpdateTenantModulesDto,
  CreateOnboardingOrderDto,
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('metrics')
  getMetrics() {
    return this.adminService.getPlatformMetrics();
  }

  @Get('revenue')
  getRevenue(@Query('search') search?: string, @Query('status') status?: string) {
    return this.adminService.getPlatformRevenue(search, status);
  }

  @Get('tenants')
  getTenants(@Query('search') search?: string, @Query('status') status?: string) {
    return this.adminService.getTenants(search, status);
  }

  @Post('tenants')
  createTenant(@Body() dto: CreateTenantDto, @Req() req: any) {
    return this.adminService.createTenant(dto, req.user?.id || 'system');
  }

  @Post('tenants/onboard-order')
  createOnboardingOrder(@Body() dto: CreateOnboardingOrderDto) {
    return this.adminService.createOnboardingOrder(dto.planId);
  }

  @Get('tenants/:id')
  getTenantById(@Param('id') id: string) {
    return this.adminService.getTenantById(id);
  }

  @Patch('tenants/:id/status')
  updateTenantStatus(@Param('id') id: string, @Body() dto: UpdateTenantStatusDto, @Req() req: any) {
    return this.adminService.updateTenantStatus(id, dto, req.user?.id || 'system');
  }

  @Patch('tenants/:id/subscription')
  updateTenantSubscription(@Param('id') id: string, @Body() dto: UpdateTenantSubscriptionDto, @Req() req: any) {
    return this.adminService.updateTenantSubscription(id, dto.planId, req.user?.id || 'system', dto.reason);
  }

  @Patch('tenants/:id/modules')
  updateTenantModules(@Param('id') id: string, @Body() dto: UpdateTenantModulesDto, @Req() req: any) {
    return this.adminService.updateTenantModules(id, dto.allowedModules, req.user?.id || 'system', dto.reason);
  }

  @Post('tenants/:id/impersonate')
  impersonateTenant(@Param('id') id: string, @Body() dto: ImpersonateTenantDto, @Req() req: any) {
    return this.adminService.impersonateTenant(id, dto, req.user, req.ip);
  }

  @Get('plans')
  getPlans() {
    return this.adminService.getPlans();
  }

  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.adminService.createPlan(dto);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.adminService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  deletePlan(@Param('id') id: string) {
    return this.adminService.deletePlan(id);
  }

  @Get('audit-logs')
  getAuditLogs() {
    return this.adminService.getAuditLogs();
  }

  @Get('analytics')
  getAnalytics(@Query('range') range?: string) {
    return this.adminService.getPlatformAnalytics(range);
  }

  // Feature Catalog Endpoints
  @Get('features')
  getFeatures() {
    return this.adminService.getFeatures();
  }

  @Post('features')
  createFeature(@Body() dto: { code: string; name: string; description?: string; category?: string }) {
    return this.adminService.createFeature(dto);
  }

  @Patch('features/:id')
  updateFeature(@Param('id') id: string, @Body() dto: { name?: string; description?: string; category?: string }) {
    return this.adminService.updateFeature(id, dto);
  }

  @Delete('features/:id')
  deleteFeature(@Param('id') id: string) {
    return this.adminService.deleteFeature(id);
  }

  // Permission Catalog Endpoints
  @Get('permissions')
  getPermissionsCatalog() {
    return this.adminService.getPermissionsCatalog();
  }

  @Post('permissions')
  createPermissionCatalog(@Body() dto: { code: string; name: string; description?: string; featureId: string }) {
    return this.adminService.createPermissionCatalog(dto);
  }

  @Patch('permissions/:id')
  updatePermissionCatalog(@Param('id') id: string, @Body() dto: { name?: string; description?: string; featureId?: string }) {
    return this.adminService.updatePermissionCatalog(id, dto);
  }

  @Delete('permissions/:id')
  deletePermissionCatalog(@Param('id') id: string) {
    return this.adminService.deletePermissionCatalog(id);
  }
}


