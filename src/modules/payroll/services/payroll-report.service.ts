import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/database/prisma.service";

@Injectable()
export class PayrollReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(tenantId: string) {
    const totalPeriods = await this.prisma.payrollPeriod.count({ where: { tenantId } });

    const totalPaidPayslips = await this.prisma.payslip.aggregate({
      where: { tenantId, status: "PAID" },
      _sum: {
        grossPay: true,
        totalDeductions: true,
        netPay: true,
        serviceCommission: true,
        productCommission: true,
      },
    });

    const recentPeriods = await this.prisma.payrollPeriod.findMany({
      where: { tenantId },
      orderBy: { startDate: "desc" },
      take: 6,
    });

    return {
      totalPeriods,
      totals: {
        grossPay: Number(totalPaidPayslips._sum.grossPay || 0),
        totalDeductions: Number(totalPaidPayslips._sum.totalDeductions || 0),
        netPay: Number(totalPaidPayslips._sum.netPay || 0),
        serviceCommission: Number(totalPaidPayslips._sum.serviceCommission || 0),
        productCommission: Number(totalPaidPayslips._sum.productCommission || 0),
      },
      recentPeriods,
    };
  }

  async getCommissionBreakdown(tenantId: string) {
    const payslips = await this.prisma.payslip.findMany({
      where: { tenantId },
      include: { staff: { select: { id: true, name: true } } },
    });

    const staffCommissions: Record<string, { staffName: string; serviceCommission: number; productCommission: number; totalCommission: number }> = {};

    for (const p of payslips) {
      const staffId = p.staffId;
      if (!staffCommissions[staffId]) {
        staffCommissions[staffId] = {
          staffName: p.staff.name,
          serviceCommission: 0,
          productCommission: 0,
          totalCommission: 0,
        };
      }

      const sComm = Number(p.serviceCommission);
      const pComm = Number(p.productCommission);

      staffCommissions[staffId].serviceCommission += sComm;
      staffCommissions[staffId].productCommission += pComm;
      staffCommissions[staffId].totalCommission += sComm + pComm;
    }

    return Object.values(staffCommissions).sort((a, b) => b.totalCommission - a.totalCommission);
  }
}
