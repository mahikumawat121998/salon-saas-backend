import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/database/prisma.service";
import { ReportsQueryDto } from "./dto/date-range-query.dto";
import { AppointmentStatus, InvoiceStatus, PaymentMethod, PaymentStatus } from "@prisma/client";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private getDateRange(query?: ReportsQueryDto) {
    const now = new Date();
    const startDate = query?.startDate
      ? new Date(query.startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1); // 1st of current month

    const endDate = query?.endDate
      ? new Date(query.endDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); // last day of current month

    return { startDate, endDate };
  }

  /**
   * Executive Dashboard Overview
   */
  async getDashboardOverview(tenantId: string, query?: ReportsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    // 1. Revenue
    const paidInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: InvoiceStatus.PAID,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { totalAmount: true },
    });

    const totalRevenue = paidInvoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    );

    // 2. Appointments
    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { status: true },
    });

    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter(
      (a) => a.status === AppointmentStatus.COMPLETED,
    ).length;
    const cancelledAppointments = appointments.filter(
      (a) => a.status === AppointmentStatus.CANCELLED,
    ).length;
    const noShowAppointments = appointments.filter(
      (a) => a.status === AppointmentStatus.NO_SHOW,
    ).length;
    const pendingAppointments = appointments.filter(
      (a) => a.status === AppointmentStatus.PENDING || a.status === AppointmentStatus.CONFIRMED,
    ).length;

    // 3. Customers
    const totalCustomers = await this.prisma.customer.count({
      where: { tenantId },
    });

    const newCustomers = await this.prisma.customer.count({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    return {
      period: { startDate, endDate },
      revenue: {
        total: totalRevenue,
      },
      appointments: {
        total: totalAppointments,
        completed: completedAppointments,
        cancelled: cancelledAppointments,
        noShow: noShowAppointments,
        pending: pendingAppointments,
        completionRate:
          totalAppointments > 0
            ? Number(((completedAppointments / totalAppointments) * 100).toFixed(2))
            : 0,
      },
      customers: {
        total: totalCustomers,
        new: newCustomers,
      },
    };
  }

  /**
   * Detailed Revenue & Payment Method Analysis
   */
  async getRevenueReport(tenantId: string, query?: ReportsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const payments = await this.prisma.payment.findMany({
      where: {
        invoice: { tenantId },
        status: PaymentStatus.COMPLETED,
        paidAt: { gte: startDate, lte: endDate },
      },
      select: {
        amount: true,
        method: true,
        paidAt: true,
      },
    });

    let cashRevenue = 0;
    let cardRevenue = 0;
    let upiRevenue = 0;

    const dailyRevenueMap = new Map<string, number>();

    payments.forEach((p) => {
      const amt = Number(p.amount);
      if (p.method === PaymentMethod.CASH) cashRevenue += amt;
      else if (p.method === PaymentMethod.CARD) cardRevenue += amt;
      else if (p.method === PaymentMethod.UPI) upiRevenue += amt;

      const dateStr = p.paidAt.toISOString().split("T")[0];
      dailyRevenueMap.set(dateStr, (dailyRevenueMap.get(dateStr) || 0) + amt);
    });

    const totalRevenue = cashRevenue + cardRevenue + upiRevenue;

    const dailyBreakdown = Array.from(dailyRevenueMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period: { startDate, endDate },
      totalRevenue,
      byPaymentMethod: {
        cash: cashRevenue,
        card: cardRevenue,
        upi: upiRevenue,
      },
      dailyBreakdown,
    };
  }

  /**
   * Staff Performance & Productivity Report
   */
  async getStaffPerformanceReport(tenantId: string, query?: ReportsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const staffMembers = await this.prisma.staff.findMany({
      where: { tenantId },
      select: { id: true, name: true, phone: true, status: true },
    });

    const report = await Promise.all(
      staffMembers.map(async (staff) => {
        const appointments = await this.prisma.appointment.findMany({
          where: {
            tenantId,
            staffId: staff.id,
            createdAt: { gte: startDate, lte: endDate },
          },
          select: { status: true, price: true },
        });

        const completed = appointments.filter(
          (a) => a.status === AppointmentStatus.COMPLETED,
        );
        const cancelled = appointments.filter(
          (a) => a.status === AppointmentStatus.CANCELLED,
        );

        const revenueGenerated = completed.reduce(
          (sum, a) => sum + Number(a.price),
          0,
        );

        return {
          staffId: staff.id,
          staffName: staff.name,
          status: staff.status,
          totalAppointments: appointments.length,
          completedAppointments: completed.length,
          cancelledAppointments: cancelled.length,
          revenueGenerated,
        };
      }),
    );

    return {
      period: { startDate, endDate },
      staffPerformance: report.sort((a, b) => b.revenueGenerated - a.revenueGenerated),
    };
  }

  /**
   * Catalog Service Popularity & Revenue Report
   */
  async getServicePerformanceReport(tenantId: string, query?: ReportsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const services = await this.prisma.service.findMany({
      where: { tenantId },
      include: { category: true },
    });

    const report = await Promise.all(
      services.map(async (service) => {
        const appointments = await this.prisma.appointment.findMany({
          where: {
            tenantId,
            serviceId: service.id,
            createdAt: { gte: startDate, lte: endDate },
          },
          select: { status: true, price: true },
        });

        const completed = appointments.filter(
          (a) => a.status === AppointmentStatus.COMPLETED,
        );

        const totalRevenue = completed.reduce(
          (sum, a) => sum + Number(a.price),
          0,
        );

        return {
          serviceId: service.id,
          serviceName: service.name,
          categoryName: service.category.name,
          durationMinutes: service.durationMinutes,
          standardPrice: service.price,
          totalBookings: appointments.length,
          completedBookings: completed.length,
          totalRevenue,
        };
      }),
    );

    return {
      period: { startDate, endDate },
      servicePerformance: report.sort((a, b) => b.totalRevenue - a.totalRevenue),
    };
  }

  /**
   * Customer Insights & Retention Report
   */
  async getCustomerInsightsReport(tenantId: string, query?: ReportsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const totalCustomers = await this.prisma.customer.count({
      where: { tenantId },
    });

    const newCustomers = await this.prisma.customer.count({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    // Customers with >= 2 completed appointments
    const customerAppointmentsGrouped = await this.prisma.appointment.groupBy({
      by: ["customerId"],
      where: {
        tenantId,
        status: AppointmentStatus.COMPLETED,
      },
      _count: {
        id: true,
      },
      having: {
        id: {
          _count: {
            gte: 2,
          },
        },
      },
    });

    const returningCustomers = customerAppointmentsGrouped.length;

    return {
      period: { startDate, endDate },
      totalCustomers,
      newCustomers,
      returningCustomers,
      retentionRate:
        totalCustomers > 0
          ? Number(((returningCustomers / totalCustomers) * 100).toFixed(2))
          : 0,
    };
  }
}
