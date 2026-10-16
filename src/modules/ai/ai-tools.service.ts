import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/database/prisma.service";
import {
  AppointmentStatus,
  AttendanceStatus,
  InvoiceStatus,
  LeaveStatus,
  PaymentMethod,
  PaymentStatus,
  StaffStatus,
} from "@prisma/client";
import { Type } from "@google/genai";

@Injectable()
export class AiToolsService {
  private readonly logger = new Logger(AiToolsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gemini Function Declarations for Tool Calling
   */
  getFunctionDeclarations() {
    return [
      {
        name: "getUpcomingAppointments",
        description:
          "Fetch appointments for a specific date (defaults to today) or filtered by status. Gives customer name, assigned staff, service, scheduled time, and status.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: {
              type: Type.STRING,
              description:
                "Date in YYYY-MM-DD format. If omitted, today's date is used.",
            },
            status: {
              type: Type.STRING,
              description:
                "Optional status filter: CONFIRMED, COMPLETED, CANCELLED, PENDING, IN_SERVICE, NO_SHOW",
            },
          },
        },
      },
      {
        name: "getRevenueSummary",
        description:
          "Get revenue financial summary for a specific date (defaults to today). Includes total revenue collected, payment method breakdown (CASH, CARD, UPI), number of invoices paid, and appointment count.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: {
              type: Type.STRING,
              description:
                "Date in YYYY-MM-DD format. If omitted, today's date is used.",
            },
          },
        },
      },
      {
        name: "getStaffOnDuty",
        description:
          "Check which staff members are scheduled to work, currently clocked in, on break, clocked out, or on approved leave for a specific date (defaults to today).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: {
              type: Type.STRING,
              description:
                "Date in YYYY-MM-DD format. If omitted, today's date is used.",
            },
          },
        },
      },
      {
        name: "getSalonServices",
        description:
          "Get the catalog of services offered by this salon, including prices, duration in minutes, and category names.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            search: {
              type: Type.STRING,
              description: "Optional keyword to search services by name",
            },
          },
        },
      },
      {
        name: "bookAppointment",
        description:
          "Book a new appointment for a customer with a staff member for a service. Customer will be found by phone or created if new.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            customerName: {
              type: Type.STRING,
              description: "Full name of the customer",
            },
            customerPhone: {
              type: Type.STRING,
              description: "Contact phone number of the customer",
            },
            serviceName: {
              type: Type.STRING,
              description: "Name of the service (e.g., Haircut, Facial, Spa)",
            },
            staffName: {
              type: Type.STRING,
              description: "Optional name of the preferred staff member/stylist",
            },
            startTime: {
              type: Type.STRING,
              description:
                "Date and time of appointment in ISO format or 'YYYY-MM-DD HH:mm' (e.g. '2026-10-16 16:00')",
            },
            notes: {
              type: Type.STRING,
              description: "Optional notes for the appointment",
            },
          },
          required: ["customerName", "customerPhone", "serviceName", "startTime"],
        },
      },
    ];
  }

  /**
   * Execute Tool by Name with tenant isolation
   */
  async executeTool(
    name: string,
    args: any,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    this.logger.log(`Executing tool ${name} for tenant: ${tenantId} with args: ${JSON.stringify(args)}`);

    switch (name) {
      case "getUpcomingAppointments":
        return this.getUpcomingAppointments(tenantId, args);

      case "getRevenueSummary":
        return this.getRevenueSummary(tenantId, args);

      case "getStaffOnDuty":
        return this.getStaffOnDuty(tenantId, args);

      case "getSalonServices":
        return this.getSalonServices(tenantId, args);

      case "bookAppointment":
        return this.bookAppointment(tenantId, userId, args);

      default:
        return { error: `Tool ${name} is not recognized.` };
    }
  }

  /**
   * Tool 1: Get Appointments
   */
  async getUpcomingAppointments(
    tenantId: string,
    args: { date?: string; status?: string },
  ) {
    const targetDate = args.date ? new Date(args.date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const where: any = {
      tenantId,
      appointmentDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    if (args.status && Object.values(AppointmentStatus).includes(args.status as any)) {
      where.status = args.status;
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        staff: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, durationMinutes: true, price: true } },
      },
      orderBy: { startAt: "asc" },
    });

    return {
      date: startOfDay.toISOString().split("T")[0],
      totalAppointments: appointments.length,
      appointments: appointments.map((a) => ({
        id: a.id,
        customerName: a.customer?.name ?? "Walk-in",
        customerPhone: a.customer?.phone ?? "N/A",
        staffName: a.staff?.name ?? "Any Staff",
        serviceName: a.service?.name ?? a.serviceName,
        startTime: a.startAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        endTime: a.endAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        durationMinutes: a.durationMinutes,
        price: Number(a.price),
        status: a.status,
        customerNotes: a.customerNotes ?? undefined,
      })),
    };
  }

  /**
   * Tool 2: Get Revenue Summary
   */
  async getRevenueSummary(tenantId: string, args: { date?: string }) {
    const targetDate = args.date ? new Date(args.date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Paid invoices
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: InvoiceStatus.PAID,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      select: {
        id: true,
        totalAmount: true,
      },
    });

    // 2. Payments received
    const payments = await this.prisma.payment.findMany({
      where: {
        invoice: { tenantId },
        status: PaymentStatus.COMPLETED,
        paidAt: { gte: startOfDay, lte: endOfDay },
      },
      select: {
        amount: true,
        method: true,
      },
    });

    let totalCollected = 0;
    let cash = 0;
    let card = 0;
    let upi = 0;
    let other = 0;

    payments.forEach((p) => {
      const amt = Number(p.amount);
      totalCollected += amt;
      if (p.method === PaymentMethod.CASH) cash += amt;
      else if (p.method === PaymentMethod.CARD) card += amt;
      else if (p.method === PaymentMethod.UPI) upi += amt;
      else other += amt;
    });

    // If no payments recorded via Payment table, fall back to paid invoices
    if (totalCollected === 0 && invoices.length > 0) {
      totalCollected = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    }

    // 3. Appointments count for that day
    const appointmentCount = await this.prisma.appointment.count({
      where: {
        tenantId,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
      },
    });

    return {
      date: startOfDay.toISOString().split("T")[0],
      totalRevenue: totalCollected,
      invoiceCount: invoices.length,
      appointmentsBooked: appointmentCount,
      paymentBreakdown: {
        cash,
        card,
        upi,
        other,
      },
      averageTicketSize: invoices.length > 0 ? Number((totalCollected / invoices.length).toFixed(2)) : 0,
    };
  }

  /**
   * Tool 3: Get Staff On Duty & Attendance
   */
  async getStaffOnDuty(tenantId: string, args: { date?: string }) {
    const targetDate = args.date ? new Date(args.date) : new Date();
    const dayOfWeek = targetDate.getDay();

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const dateZeroUtc = new Date(targetDate);
    dateZeroUtc.setUTCHours(0, 0, 0, 0);

    // All active staff
    const staffList = await this.prisma.staff.findMany({
      where: { tenantId, status: StaffStatus.ACTIVE },
      select: { id: true, name: true, phone: true },
    });

    // Schedules for today
    const schedules = await this.prisma.staffSchedule.findMany({
      where: { tenantId, dayOfWeek },
    });
    const scheduleMap = new Map(schedules.map((s) => [s.staffId, s]));

    // Attendances for today
    const attendances = await this.prisma.staffAttendance.findMany({
      where: {
        tenantId,
        date: dateZeroUtc,
      },
      include: { breaks: true },
    });
    const attendanceMap = new Map(attendances.map((a) => [a.staffId, a]));

    // Approved leaves for today
    const leaves = await this.prisma.staffLeave.findMany({
      where: {
        tenantId,
        status: LeaveStatus.APPROVED,
        startAt: { lte: endOfDay },
        endAt: { gte: startOfDay },
      },
    });
    const leaveMap = new Map(leaves.map((l) => [l.staffId, l]));

    let onDutyCount = 0;
    let onLeaveCount = 0;

    const staffStatusList = staffList.map((member) => {
      const schedule = scheduleMap.get(member.id);
      const attendance = attendanceMap.get(member.id);
      const leave = leaveMap.get(member.id);

      let status = "NOT_SCHEDULED";
      let isWorking = false;

      if (leave) {
        status = "ON_LEAVE";
        onLeaveCount++;
      } else if (attendance) {
        if (attendance.clockOut) {
          status = "CLOCKED_OUT";
        } else if (attendance.breaks?.some((b) => !b.endTime)) {
          status = "ON_BREAK";
          onDutyCount++;
        } else if (attendance.clockIn) {
          status = "ON_DUTY";
          isWorking = true;
          onDutyCount++;
        } else if (attendance.status === AttendanceStatus.ABSENT) {
          status = "ABSENT";
        }
      } else if (schedule?.isWorking) {
        status = "SCHEDULED_NOT_CLOCKED_IN";
      }

      return {
        id: member.id,
        name: member.name,
        phone: member.phone,
        status,
        isWorking,
        scheduledHours: schedule?.isWorking ? `${schedule.startTime} - ${schedule.endTime}` : "Off",
        clockIn: attendance?.clockIn ? attendance.clockIn.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null,
        clockOut: attendance?.clockOut ? attendance.clockOut.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null,
        leaveReason: leave?.reason ?? undefined,
      };
    });

    return {
      date: startOfDay.toISOString().split("T")[0],
      totalActiveStaff: staffList.length,
      currentlyOnDuty: onDutyCount,
      onLeave: onLeaveCount,
      staff: staffStatusList,
    };
  }

  /**
   * Tool 4: Get Salon Services Catalog
   */
  async getSalonServices(tenantId: string, args: { search?: string }) {
    const where: any = { tenantId };
    if (args.search) {
      where.name = { contains: args.search, mode: "insensitive" };
    }

    const services = await this.prisma.service.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 25,
    });

    return {
      count: services.length,
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category?.name ?? "General",
        durationMinutes: s.durationMinutes,
        price: s.price,
      })),
    };
  }

  /**
   * Tool 5: Book Appointment
   */
  async bookAppointment(
    tenantId: string,
    userId: string,
    args: {
      customerName: string;
      customerPhone: string;
      serviceName: string;
      staffName?: string;
      startTime: string;
      notes?: string;
    },
  ) {
    // 1. Find or create customer
    let customer = await this.prisma.customer.findFirst({
      where: { tenantId, phone: args.customerPhone },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          tenantId,
          name: args.customerName,
          phone: args.customerPhone,
        },
      });
    }

    // 2. Find service
    const service = await this.prisma.service.findFirst({
      where: {
        tenantId,
        name: { contains: args.serviceName, mode: "insensitive" },
      },
    });

    if (!service) {
      return {
        success: false,
        message: `Could not find a service matching "${args.serviceName}". Please check the catalog.`,
      };
    }

    // 3. Find staff
    let selectedStaffId: string | null = null;
    let selectedStaffName = "Unassigned Staff";
    if (args.staffName) {
      const staff = await this.prisma.staff.findFirst({
        where: {
          tenantId,
          name: { contains: args.staffName, mode: "insensitive" },
        },
      });
      if (staff) {
        selectedStaffId = staff.id;
        selectedStaffName = staff.name;
      }
    }

    if (!selectedStaffId) {
      // Pick first active staff member as fallback
      const defaultStaff = await this.prisma.staff.findFirst({
        where: { tenantId, status: StaffStatus.ACTIVE },
      });
      if (defaultStaff) {
        selectedStaffId = defaultStaff.id;
        selectedStaffName = defaultStaff.name;
      } else {
        return {
          success: false,
          message: "No active staff member available in this salon to assign the appointment.",
        };
      }
    }

    // Parse start time
    const startAt = new Date(args.startTime);
    if (isNaN(startAt.getTime())) {
      return {
        success: false,
        message: `Invalid date/time format: "${args.startTime}". Please provide a valid timestamp.`,
      };
    }

    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60000);
    const appointmentDate = new Date(startAt);
    appointmentDate.setHours(0, 0, 0, 0);

    const appointment = await this.prisma.appointment.create({
      data: {
        tenantId,
        customerId: customer.id,
        staffId: selectedStaffId,
        serviceId: service.id,
        appointmentDate,
        startAt,
        endAt,
        status: AppointmentStatus.CONFIRMED,
        serviceName: service.name,
        durationMinutes: service.durationMinutes,
        price: service.price,
        customerNotes: args.notes,
        createdBy: userId,
      },
    });

    return {
      success: true,
      message: `Appointment successfully booked for ${customer.name} on ${startAt.toLocaleString()}!`,
      appointment: {
        id: appointment.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        serviceName: service.name,
        staffName: selectedStaffName,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        price: service.price,
      },
    };
  }
}
