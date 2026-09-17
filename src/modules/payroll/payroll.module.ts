import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/database/prisma.module";
import { PayrollController } from "./payroll.controller";
import { PayrollConfigService } from "./services/payroll-config.service";
import { PayrollCalculationService } from "./services/payroll-calculation.service";
import { PayrollPeriodService } from "./services/payroll-period.service";
import { PayrollReportService } from "./services/payroll-report.service";

@Module({
  imports: [PrismaModule],
  controllers: [PayrollController],
  providers: [
    PayrollConfigService,
    PayrollCalculationService,
    PayrollPeriodService,
    PayrollReportService,
  ],
  exports: [
    PayrollConfigService,
    PayrollCalculationService,
    PayrollPeriodService,
    PayrollReportService,
  ],
})
export class PayrollModule {}
