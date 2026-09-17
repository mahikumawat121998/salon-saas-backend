import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionGuard, RequirePermission } from "../../common/guards/permission.guard";
import { PayrollConfigService } from "./services/payroll-config.service";
import { PayrollPeriodService } from "./services/payroll-period.service";
import { PayrollReportService } from "./services/payroll-report.service";
import { CreateSalaryConfigDto } from "./dto/create-salary-config.dto";
import { CreatePayrollPeriodDto } from "./dto/create-payroll-period.dto";
import { AdjustPayslipDto } from "./dto/adjust-payslip.dto";
import { DisbursePayslipDto } from "./dto/disburse-payslip.dto";
import { PayrollPeriodStatus } from "@prisma/client";

@Controller("payroll")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PayrollController {
  constructor(
    private readonly configService: PayrollConfigService,
    private readonly periodService: PayrollPeriodService,
    private readonly reportService: PayrollReportService
  ) {}

  // =========================================================================
  // SALARY CONFIGURATIONS
  // =========================================================================

  @Get("configurations")
  @RequirePermission("payroll.view")
  async getStaffConfigs(@Req() req: any) {
    return this.configService.getStaffConfigs(req.user.tenantId);
  }

  @Get("configurations/:staffId")
  @RequirePermission("payroll.view")
  async getStaffConfigById(@Req() req: any, @Param("staffId") staffId: string) {
    return this.configService.getStaffConfigById(req.user.tenantId, staffId);
  }

  @Put("configurations/:staffId")
  @RequirePermission("payroll.config")
  async upsertSalaryConfig(
    @Req() req: any,
    @Param("staffId") staffId: string,
    @Body() dto: CreateSalaryConfigDto
  ) {
    return this.configService.upsertSalaryConfig(
      req.user.tenantId,
      staffId,
      dto,
      req.user.id
    );
  }

  // =========================================================================
  // PAYROLL PERIODS & RUNS
  // =========================================================================

  @Get("periods")
  @RequirePermission("payroll.view")
  async getPeriods(@Req() req: any) {
    return this.periodService.getPeriods(req.user.tenantId);
  }

  @Get("periods/:id")
  @RequirePermission("payroll.view")
  async getPeriodById(@Req() req: any, @Param("id") id: string) {
    return this.periodService.getPeriodById(req.user.tenantId, id);
  }

  @Post("periods")
  @RequirePermission("payroll.process")
  async createPeriod(@Req() req: any, @Body() dto: CreatePayrollPeriodDto) {
    return this.periodService.createPeriod(req.user.tenantId, dto, req.user.id);
  }

  @Post("periods/:id/calculate")
  @RequirePermission("payroll.process")
  async calculatePeriodPayslips(@Req() req: any, @Param("id") id: string) {
    return this.periodService.calculatePeriodPayslips(req.user.tenantId, id);
  }

  @Patch("periods/:id/status")
  @RequirePermission("payroll.approve")
  async updatePeriodStatus(
    @Req() req: any,
    @Param("id") id: string,
    @Body("status") status: PayrollPeriodStatus
  ) {
    return this.periodService.updatePeriodStatus(
      req.user.tenantId,
      id,
      status,
      req.user.id
    );
  }

  // =========================================================================
  // PAYSLIP ADJUSTMENTS & DISBURSEMENTS
  // =========================================================================

  @Patch("payslips/:id/adjustments")
  @RequirePermission("payroll.process")
  async adjustPayslip(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: AdjustPayslipDto
  ) {
    return this.periodService.adjustPayslip(
      req.user.tenantId,
      id,
      dto,
      req.user.id
    );
  }

  @Post("payslips/:id/disburse")
  @RequirePermission("payroll.pay")
  async disbursePayslip(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: DisbursePayslipDto
  ) {
    return this.periodService.disbursePayslip(
      req.user.tenantId,
      id,
      dto,
      req.user.id
    );
  }

  // =========================================================================
  // REPORTS & ANALYTICS
  // =========================================================================

  @Get("reports/summary")
  @RequirePermission("payroll.reports")
  async getSummary(@Req() req: any) {
    return this.reportService.getSummary(req.user.tenantId);
  }

  @Get("reports/commissions")
  @RequirePermission("payroll.reports")
  async getCommissionBreakdown(@Req() req: any) {
    return this.reportService.getCommissionBreakdown(req.user.tenantId);
  }
}
