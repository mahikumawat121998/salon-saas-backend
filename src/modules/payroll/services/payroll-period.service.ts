import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/database/prisma.service";
import { PayrollCalculationService } from "./payroll-calculation.service";
import { CreatePayrollPeriodDto } from "../dto/create-payroll-period.dto";
import { AdjustPayslipDto } from "../dto/adjust-payslip.dto";
import { DisbursePayslipDto } from "../dto/disburse-payslip.dto";
import { PayrollPeriodStatus, PayslipStatus } from "@prisma/client";

@Injectable()
export class PayrollPeriodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calcService: PayrollCalculationService
  ) {}

  async getPeriods(tenantId: string) {
    return this.prisma.payrollPeriod.findMany({
      where: { tenantId },
      include: {
        _count: { select: { payslips: true } },
      },
      orderBy: { startDate: "desc" },
    });
  }

  async getPeriodById(tenantId: string, id: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
      include: {
        payslips: {
          include: {
            staff: { select: { id: true, name: true, phone: true } },
            items: true,
          },
          orderBy: { staff: { name: "asc" } },
        },
      },
    });

    if (!period) {
      throw new NotFoundException("Payroll period not found");
    }

    return period;
  }

  async createPeriod(tenantId: string, dto: CreatePayrollPeriodDto, actorUserId?: string) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException("Start date must be before end date");
    }

    const period = await this.prisma.payrollPeriod.create({
      data: {
        tenantId,
        name: dto.name,
        startDate,
        endDate,
        workingDaysCount: dto.workingDaysCount,
        status: PayrollPeriodStatus.DRAFT,
      },
    });

    // Auto-calculate initial draft payslips
    await this.calculatePeriodPayslips(tenantId, period.id);

    if (actorUserId) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId,
          targetTenantId: tenantId,
          action: "PAYROLL_PERIOD_CREATED",
          details: `Created payroll period '${dto.name}' (${dto.startDate} to ${dto.endDate})`,
        },
      });
    }

    return this.getPeriodById(tenantId, period.id);
  }

  async calculatePeriodPayslips(tenantId: string, periodId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
    });

    if (!period) {
      throw new NotFoundException("Payroll period not found");
    }

    if (period.status === PayrollPeriodStatus.APPROVED || period.status === PayrollPeriodStatus.PAID) {
      throw new BadRequestException("Cannot recalculate approved or paid payroll period");
    }

    const activeStaff = await this.prisma.staff.findMany({
      where: { tenantId, status: "ACTIVE" },
    });

    let periodGross = 0;
    let periodDeductions = 0;
    let periodNet = 0;

    for (const staff of activeStaff) {
      // Check for existing manual overrides
      const existingPayslip = await this.prisma.payslip.findUnique({
        where: { payrollPeriodId_staffId: { payrollPeriodId: periodId, staffId: staff.id } },
      });

      const calcResult = await this.calcService.calculateStaffPayslip({
        tenantId,
        staffId: staff.id,
        startDate: period.startDate,
        endDate: period.endDate,
        totalWorkingDaysInPeriod: period.workingDaysCount,
        manualOverrides: existingPayslip
          ? {
              overtimeHours: existingPayslip.overtimeHours,
              unpaidLeaveDays: existingPayslip.unpaidLeaveDays,
              bonusAmount: Number(existingPayslip.bonusAmount),
            }
          : undefined,
      });

      // Upsert Payslip
      const payslip = await this.prisma.payslip.upsert({
        where: { payrollPeriodId_staffId: { payrollPeriodId: periodId, staffId: staff.id } },
        create: {
          tenantId,
          payrollPeriodId: periodId,
          staffId: staff.id,
          payStructureType: calcResult.payStructureType,
          totalWorkingDays: calcResult.totalWorkingDays,
          presentDays: calcResult.presentDays,
          unpaidLeaveDays: calcResult.unpaidLeaveDays,
          paidLeaveDays: calcResult.paidLeaveDays,
          overtimeHours: calcResult.overtimeHours,
          baseEarned: calcResult.baseEarned,
          overtimePay: calcResult.overtimePay,
          serviceCommission: calcResult.serviceCommission,
          productCommission: calcResult.productCommission,
          allowancesTotal: calcResult.allowancesTotal,
          bonusAmount: calcResult.bonusAmount,
          grossPay: calcResult.grossPay,
          leaveDeduction: calcResult.leaveDeduction,
          otherDeductionsTotal: calcResult.otherDeductionsTotal,
          statutoryDeductionsTotal: calcResult.statutoryDeductionsTotal,
          totalDeductions: calcResult.totalDeductions,
          netPay: calcResult.netPay,
          status: PayslipStatus.DRAFT,
        },
        update: {
          payStructureType: calcResult.payStructureType,
          totalWorkingDays: calcResult.totalWorkingDays,
          presentDays: calcResult.presentDays,
          unpaidLeaveDays: calcResult.unpaidLeaveDays,
          paidLeaveDays: calcResult.paidLeaveDays,
          overtimeHours: calcResult.overtimeHours,
          baseEarned: calcResult.baseEarned,
          overtimePay: calcResult.overtimePay,
          serviceCommission: calcResult.serviceCommission,
          productCommission: calcResult.productCommission,
          allowancesTotal: calcResult.allowancesTotal,
          bonusAmount: calcResult.bonusAmount,
          grossPay: calcResult.grossPay,
          leaveDeduction: calcResult.leaveDeduction,
          otherDeductionsTotal: calcResult.otherDeductionsTotal,
          statutoryDeductionsTotal: calcResult.statutoryDeductionsTotal,
          totalDeductions: calcResult.totalDeductions,
          netPay: calcResult.netPay,
        },
      });

      // Re-create items
      await this.prisma.payslipItem.deleteMany({ where: { payslipId: payslip.id } });
      await this.prisma.payslipItem.createMany({
        data: calcResult.items.map((item) => ({
          payslipId: payslip.id,
          name: item.name,
          category: item.category,
          type: item.type,
          amount: item.amount,
        })),
      });

      periodGross += calcResult.grossPay;
      periodDeductions += calcResult.totalDeductions;
      periodNet += calcResult.netPay;
    }

    // Update Period Totals
    await this.prisma.payrollPeriod.update({
      where: { id: periodId },
      data: {
        totalGrossPay: Math.round(periodGross * 100) / 100,
        totalDeductions: Math.round(periodDeductions * 100) / 100,
        totalNetPay: Math.round(periodNet * 100) / 100,
        processedAt: new Date(),
      },
    });

    return this.getPeriodById(tenantId, periodId);
  }

  async adjustPayslip(tenantId: string, payslipId: string, dto: AdjustPayslipDto, actorUserId?: string) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, tenantId },
      include: { payrollPeriod: true },
    });

    if (!payslip) {
      throw new NotFoundException("Payslip not found");
    }

    if (payslip.status === PayslipStatus.PAID || payslip.payrollPeriod.status === PayrollPeriodStatus.PAID) {
      throw new BadRequestException("Cannot adjust a paid payslip");
    }

    const calcResult = await this.calcService.calculateStaffPayslip({
      tenantId,
      staffId: payslip.staffId,
      startDate: payslip.payrollPeriod.startDate,
      endDate: payslip.payrollPeriod.endDate,
      totalWorkingDaysInPeriod: payslip.payrollPeriod.workingDaysCount,
      manualOverrides: {
        overtimeHours: dto.overtimeHours ?? payslip.overtimeHours,
        unpaidLeaveDays: dto.unpaidLeaveDays ?? payslip.unpaidLeaveDays,
        bonusAmount: dto.bonusAmount ?? Number(payslip.bonusAmount),
        manualDeduction: dto.manualDeduction,
        adjustmentReason: dto.adjustmentReason,
      },
    });

    await this.prisma.payslip.update({
      where: { id: payslipId },
      data: {
        totalWorkingDays: calcResult.totalWorkingDays,
        presentDays: calcResult.presentDays,
        unpaidLeaveDays: calcResult.unpaidLeaveDays,
        overtimeHours: calcResult.overtimeHours,
        baseEarned: calcResult.baseEarned,
        overtimePay: calcResult.overtimePay,
        serviceCommission: calcResult.serviceCommission,
        productCommission: calcResult.productCommission,
        allowancesTotal: calcResult.allowancesTotal,
        bonusAmount: calcResult.bonusAmount,
        grossPay: calcResult.grossPay,
        leaveDeduction: calcResult.leaveDeduction,
        otherDeductionsTotal: calcResult.otherDeductionsTotal,
        totalDeductions: calcResult.totalDeductions,
        netPay: calcResult.netPay,
      },
    });

    await this.prisma.payslipItem.deleteMany({ where: { payslipId } });
    await this.prisma.payslipItem.createMany({
      data: calcResult.items.map((item) => ({
        payslipId,
        name: item.name,
        category: item.category,
        type: item.type,
        amount: item.amount,
      })),
    });

    if (actorUserId) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId,
          targetTenantId: tenantId,
          action: "PAYSLIP_ADJUSTED",
          details: `Adjusted payslip ID ${payslipId}. Reason: ${dto.adjustmentReason || "Manual adjustments"}`,
        },
      });
    }

    return this.prisma.payslip.findUnique({
      where: { id: payslipId },
      include: { staff: true, items: true },
    });
  }

  async updatePeriodStatus(tenantId: string, periodId: string, status: PayrollPeriodStatus, actorUserId?: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
    });

    if (!period) {
      throw new NotFoundException("Payroll period not found");
    }

    const updateData: any = { status };

    if (status === PayrollPeriodStatus.APPROVED) {
      updateData.approvedAt = new Date();
      updateData.approvedBy = actorUserId;
      // Mark all payslips as APPROVED
      await this.prisma.payslip.updateMany({
        where: { payrollPeriodId: periodId },
        data: { status: PayslipStatus.APPROVED },
      });
    } else if (status === PayrollPeriodStatus.PAID) {
      updateData.paidAt = new Date();
      // Mark all payslips as PAID
      await this.prisma.payslip.updateMany({
        where: { payrollPeriodId: periodId },
        data: { status: PayslipStatus.PAID, paidAt: new Date() },
      });
    }

    const updated = await this.prisma.payrollPeriod.update({
      where: { id: periodId },
      data: updateData,
    });

    if (actorUserId) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId,
          targetTenantId: tenantId,
          action: `PAYROLL_PERIOD_${status}`,
          details: `Transitioned payroll period '${period.name}' status to ${status}`,
        },
      });
    }

    return updated;
  }

  async disbursePayslip(tenantId: string, payslipId: string, dto: DisbursePayslipDto, actorUserId?: string) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, tenantId },
    });

    if (!payslip) {
      throw new NotFoundException("Payslip not found");
    }

    const updated = await this.prisma.payslip.update({
      where: { id: payslipId },
      data: {
        status: PayslipStatus.PAID,
        paymentMode: dto.paymentMode,
        paymentReference: dto.paymentReference,
        paymentNotes: dto.paymentNotes,
        paidAt: new Date(),
      },
    });

    if (actorUserId) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId,
          targetTenantId: tenantId,
          action: "PAYSLIP_DISBURSED",
          details: `Disbursed payslip ID ${payslipId} via ${dto.paymentMode} (Ref: ${dto.paymentReference || "N/A"})`,
        },
      });
    }

    return updated;
  }
}
