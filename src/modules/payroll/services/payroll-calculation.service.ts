import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/database/prisma.service";
import {
  PayStructureType,
  ComponentType,
  ComponentCalculationType,
  CommissionCalcMode,
  AppointmentStatus,
  InvoiceStatus,
} from "@prisma/client";

export interface CalculationInput {
  tenantId: string;
  staffId: string;
  startDate: Date;
  endDate: Date;
  totalWorkingDaysInPeriod: number;
  manualOverrides?: {
    overtimeHours?: number;
    unpaidLeaveDays?: number;
    bonusAmount?: number;
    manualDeduction?: number;
    adjustmentReason?: string;
  };
}

export interface CalculatedPayslipData {
  staffId: string;
  payStructureType: PayStructureType;
  totalWorkingDays: number;
  presentDays: number;
  unpaidLeaveDays: number;
  paidLeaveDays: number;
  overtimeHours: number;
  baseEarned: number;
  overtimePay: number;
  serviceCommission: number;
  productCommission: number;
  allowancesTotal: number;
  bonusAmount: number;
  grossPay: number;
  leaveDeduction: number;
  otherDeductionsTotal: number;
  statutoryDeductionsTotal: number;
  totalDeductions: number;
  netPay: number;
  items: Array<{
    name: string;
    category: string;
    type: ComponentType;
    amount: number;
  }>;
}

@Injectable()
export class PayrollCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateStaffPayslip(input: CalculationInput): Promise<CalculatedPayslipData> {
    const { tenantId, staffId, startDate, endDate, totalWorkingDaysInPeriod, manualOverrides } = input;

    // 1. Fetch Staff Salary Config
    const salaryConfig = await this.prisma.staffSalaryConfig.findUnique({
      where: { staffId },
      include: {
        components: { where: { isActive: true } },
        commissionRules: { include: { tiers: { orderBy: { minRevenueVolume: "asc" } } } },
      },
    });

    const payStructureType = salaryConfig?.payStructureType || PayStructureType.MONTHLY;
    const baseSalary = Number(salaryConfig?.baseSalary || 0);
    const dailyRate = Number(salaryConfig?.dailyRate || 0);
    const hourlyRate = Number(salaryConfig?.hourlyRate || 0);
    const overtimeRatePerHour = Number(salaryConfig?.overtimeRatePerHour || 0);
    const overtimeMultiplier = salaryConfig?.overtimeMultiplier || 1.5;

    // 2. Aggregate Unpaid & Paid Leaves
    const leaves = await this.prisma.staffLeave.findMany({
      where: {
        tenantId,
        staffId,
        startAt: { lte: endDate },
        endAt: { gte: startDate },
      },
    });

    let totalLeaveDays = 0;
    for (const l of leaves) {
      const ms = Math.min(l.endAt.getTime(), endDate.getTime()) - Math.max(l.startAt.getTime(), startDate.getTime());
      const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
      totalLeaveDays += days;
    }

    const unpaidLeaveDays = manualOverrides?.unpaidLeaveDays ?? totalLeaveDays;
    const paidLeaveDays = 0; // Configurable
    const presentDays = Math.max(0, totalWorkingDaysInPeriod - unpaidLeaveDays);
    const overtimeHours = manualOverrides?.overtimeHours ?? 0;
    const bonusAmount = manualOverrides?.bonusAmount ?? 0;

    // 3. Compute Base Salary Earned & Leave Deductions
    let baseEarned = 0;
    let leaveDeduction = 0;

    const dailyBaseRate = totalWorkingDaysInPeriod > 0 ? baseSalary / totalWorkingDaysInPeriod : 0;

    switch (payStructureType) {
      case PayStructureType.MONTHLY:
        baseEarned = Math.max(0, baseSalary - unpaidLeaveDays * dailyBaseRate);
        leaveDeduction = unpaidLeaveDays * dailyBaseRate;
        break;

      case PayStructureType.DAILY:
        baseEarned = presentDays * dailyRate;
        leaveDeduction = 0;
        break;

      case PayStructureType.HOURLY:
        const estimatedHoursWorked = presentDays * 8;
        baseEarned = estimatedHoursWorked * hourlyRate;
        leaveDeduction = 0;
        break;

      case PayStructureType.FIXED_AND_COMMISSION:
        baseEarned = Math.max(0, baseSalary - unpaidLeaveDays * dailyBaseRate);
        leaveDeduction = unpaidLeaveDays * dailyBaseRate;
        break;

      case PayStructureType.COMMISSION_ONLY:
        baseEarned = 0;
        leaveDeduction = 0;
        break;
    }

    // 4. Compute Overtime Pay
    const effectiveHourlyRate = hourlyRate > 0 ? hourlyRate : dailyBaseRate / 8;
    const effectiveOvertimeRate = overtimeRatePerHour > 0 ? overtimeRatePerHour : effectiveHourlyRate * overtimeMultiplier;
    const overtimePay = overtimeHours * effectiveOvertimeRate;

    // 5. Aggregate Completed Appointments & Calculate Service Commissions
    const completedAppointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        staffId,
        status: AppointmentStatus.COMPLETED,
        appointmentDate: { gte: startDate, lte: endDate },
      },
    });

    const totalServiceRevenue = completedAppointments.reduce((sum, appt) => sum + Number(appt.price), 0);

    let serviceCommission = 0;
    const serviceRule = salaryConfig?.commissionRules.find((r) => r.type === "SERVICE");

    if (serviceRule) {
      serviceCommission = this.calculateCommission(totalServiceRevenue, serviceRule);
    }

    // 6. Aggregate Paid Invoices & Product Commissions
    const paidInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: InvoiceStatus.PAID,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { items: true },
    });

    // Product sales calculation
    const totalProductRevenue = 0; // Can be linked via Invoice items
    let productCommission = 0;
    const productRule = salaryConfig?.commissionRules.find((r) => r.type === "PRODUCT");
    if (productRule) {
      productCommission = this.calculateCommission(totalProductRevenue, productRule);
    }

    // 7. Calculate Allowances & Custom Deductions
    let allowancesTotal = 0;
    let otherDeductionsTotal = manualOverrides?.manualDeduction ?? 0;

    const items: Array<{ name: string; category: string; type: ComponentType; amount: number }> = [];

    if (baseEarned > 0) {
      items.push({ name: "Base Salary", category: "BASE", type: ComponentType.EARNING, amount: Math.round(baseEarned * 100) / 100 });
    }

    if (overtimePay > 0) {
      items.push({ name: "Overtime Pay", category: "OVERTIME", type: ComponentType.EARNING, amount: Math.round(overtimePay * 100) / 100 });
    }

    if (serviceCommission > 0) {
      items.push({ name: "Service Commission", category: "SERVICE_COMMISSION", type: ComponentType.EARNING, amount: Math.round(serviceCommission * 100) / 100 });
    }

    if (productCommission > 0) {
      items.push({ name: "Product Commission", category: "PRODUCT_COMMISSION", type: ComponentType.EARNING, amount: Math.round(productCommission * 100) / 100 });
    }

    if (bonusAmount > 0) {
      items.push({ name: "Performance Bonus", category: "BONUS", type: ComponentType.EARNING, amount: Math.round(bonusAmount * 100) / 100 });
    }

    // Process Salary Components
    if (salaryConfig?.components) {
      for (const comp of salaryConfig.components) {
        let val = Number(comp.value);
        if (comp.calculationType === ComponentCalculationType.PERCENTAGE_OF_BASE) {
          val = (baseSalary * val) / 100;
        }

        if (comp.type === ComponentType.EARNING) {
          allowancesTotal += val;
          items.push({ name: comp.name, category: "ALLOWANCE", type: ComponentType.EARNING, amount: Math.round(val * 100) / 100 });
        } else {
          otherDeductionsTotal += val;
          items.push({ name: comp.name, category: "DEDUCTION", type: ComponentType.DEDUCTION, amount: Math.round(val * 100) / 100 });
        }
      }
    }

    if (leaveDeduction > 0) {
      items.push({ name: `Unpaid Leave Deduction (${unpaidLeaveDays} days)`, category: "DEDUCTION", type: ComponentType.DEDUCTION, amount: Math.round(leaveDeduction * 100) / 100 });
    }

    if (manualOverrides?.manualDeduction && manualOverrides.manualDeduction > 0) {
      items.push({ name: manualOverrides.adjustmentReason || "Manual Adjustment Deduction", category: "DEDUCTION", type: ComponentType.DEDUCTION, amount: Math.round(manualOverrides.manualDeduction * 100) / 100 });
    }

    // 8. Extensible Statutory Deductions Slot (PF/ESI/TDS/PT)
    const statutoryDeductionsTotal = 0;

    // 9. Gross Pay & Net Pay
    const grossPay = baseEarned + overtimePay + serviceCommission + productCommission + allowancesTotal + bonusAmount;
    const totalDeductions = leaveDeduction + otherDeductionsTotal + statutoryDeductionsTotal;
    const netPay = Math.max(0, grossPay - totalDeductions);

    return {
      staffId,
      payStructureType,
      totalWorkingDays: totalWorkingDaysInPeriod,
      presentDays,
      unpaidLeaveDays,
      paidLeaveDays,
      overtimeHours,
      baseEarned: Math.round(baseEarned * 100) / 100,
      overtimePay: Math.round(overtimePay * 100) / 100,
      serviceCommission: Math.round(serviceCommission * 100) / 100,
      productCommission: Math.round(productCommission * 100) / 100,
      allowancesTotal: Math.round(allowancesTotal * 100) / 100,
      bonusAmount: Math.round(bonusAmount * 100) / 100,
      grossPay: Math.round(grossPay * 100) / 100,
      leaveDeduction: Math.round(leaveDeduction * 100) / 100,
      otherDeductionsTotal: Math.round(otherDeductionsTotal * 100) / 100,
      statutoryDeductionsTotal: Math.round(statutoryDeductionsTotal * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      netPay: Math.round(netPay * 100) / 100,
      items,
    };
  }

  private calculateCommission(totalRevenue: number, rule: any): number {
    if (totalRevenue <= 0) return 0;

    if (rule.calcMode === CommissionCalcMode.FLAT_PERCENTAGE) {
      const rate = Number(rule.flatRate || 0);
      return (totalRevenue * rate) / 100;
    }

    if (rule.calcMode === CommissionCalcMode.FLAT_AMOUNT) {
      return Number(rule.flatRate || 0);
    }

    if (rule.calcMode === CommissionCalcMode.TIERED_VOLUME && rule.tiers && rule.tiers.length > 0) {
      for (const tier of rule.tiers) {
        const min = Number(tier.minRevenueVolume);
        const max = tier.maxRevenueVolume !== null ? Number(tier.maxRevenueVolume) : Infinity;
        if (totalRevenue >= min && totalRevenue <= max) {
          const rate = Number(tier.commissionRate);
          return (totalRevenue * rate) / 100;
        }
      }
    }

    return 0;
  }
}
