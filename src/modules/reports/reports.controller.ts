import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { ReportsQueryDto } from "./dto/date-range-query.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ApiMessage } from "../../common/decorators/api-message.decorator";
import { PlanGuard } from "../../common/guards/plan.guard";
import { RequirePlanModule } from "../../common/decorators/require-plan-module.decorator";

@Controller("reports")
@UseGuards(PlanGuard)
@RequirePlanModule('REPORTS')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("dashboard")
  @ApiMessage("Dashboard summary metrics fetched successfully")
  getDashboardOverview(@Query() query: ReportsQueryDto, @CurrentUser() user: any) {
    return this.reportsService.getDashboardOverview(user.tenantId, query);
  }

  @Get("revenue")
  @ApiMessage("Revenue analytics report fetched successfully")
  getRevenueReport(@Query() query: ReportsQueryDto, @CurrentUser() user: any) {
    return this.reportsService.getRevenueReport(user.tenantId, query);
  }

  @Get("staff-performance")
  @ApiMessage("Staff performance report fetched successfully")
  getStaffPerformanceReport(
    @Query() query: ReportsQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getStaffPerformanceReport(user.tenantId, query);
  }

  @Get("service-performance")
  @ApiMessage("Service performance report fetched successfully")
  getServicePerformanceReport(
    @Query() query: ReportsQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getServicePerformanceReport(user.tenantId, query);
  }

  @Get("customer-insights")
  @ApiMessage("Customer insights report fetched successfully")
  getCustomerInsightsReport(
    @Query() query: ReportsQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getCustomerInsightsReport(user.tenantId, query);
  }
}
