import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/database/prisma.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { RescheduleAppointmentDto } from "./dto/reschedule-appointment.dto";
import { CancelAppointmentDto } from "./dto/cancel-appointment.dto";
import { UpdateAppointmentStatusDto } from "./dto/update-appointment.dto";
import { GetAvailableSlotsDto, GetCalendarQueryDto } from "./dto/appointment-query.dto";
import { AppointmentStatus } from "@prisma/client";

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Available-slot calculation engine
   */
  async getAvailableSlots(tenantId: string, query: GetAvailableSlotsDto) {
    const { staffId, serviceId, date, slotIntervalMinutes = 15 } = query;

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, tenantId },
    });
    if (!service) {
      throw new NotFoundException("Service not found");
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException("Invalid date format. Use YYYY-MM-DD.");
    }

    const dayOfWeek = targetDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Check staff leave
    const leaves = await this.prisma.staffLeave.findMany({
      where: {
        tenantId,
        staffId,
        startAt: { lte: endOfDay },
        endAt: { gte: startOfDay },
      },
    });
    if (leaves.length > 0) {
      return []; // Staff is on leave
    }

    // Check weekly schedule
    const schedule = await this.prisma.staffSchedule.findFirst({
      where: { tenantId, staffId, dayOfWeek },
    });
    if (!schedule || !schedule.isWorking) {
      return []; // Staff does not work on this day
    }

    // Parse schedule start/end times
    const [startH, startM] = schedule.startTime.split(":").map(Number);
    const [endH, endM] = schedule.endTime.split(":").map(Number);

    const scheduleStart = new Date(targetDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(targetDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    // Fetch breaks for dayOfWeek
    const breaks = await this.prisma.staffBreak.findMany({
      where: { tenantId, staffId, dayOfWeek },
    });

    const breakIntervals = breaks.map((b) => {
      const [bStartH, bStartM] = b.startTime.split(":").map(Number);
      const [bEndH, bEndM] = b.endTime.split(":").map(Number);

      const bStart = new Date(targetDate);
      bStart.setHours(bStartH, bStartM, 0, 0);

      const bEnd = new Date(targetDate);
      bEnd.setHours(bEndH, bEndM, 0, 0);

      return { start: bStart, end: bEnd };
    });

    // Fetch existing non-cancelled appointments
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        staffId,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      },
    });

    const bookedIntervals = existingAppointments.map((a) => ({
      start: new Date(a.startAt),
      end: new Date(a.endAt),
    }));

    const durationMs = service.durationMinutes * 60000;
    const intervalMs = slotIntervalMinutes * 60000;

    const availableSlots: Array<{ startAt: string; endAt: string }> = [];

    let currentSlotStart = new Date(scheduleStart);

    while (currentSlotStart.getTime() + durationMs <= scheduleEnd.getTime()) {
      const currentSlotEnd = new Date(currentSlotStart.getTime() + durationMs);

      // Check break overlaps
      const overlapsBreak = breakIntervals.some(
        (b) => currentSlotStart < b.end && currentSlotEnd > b.start,
      );

      // Check appointment overlaps
      const overlapsAppointment = bookedIntervals.some(
        (appt) => currentSlotStart < appt.end && currentSlotEnd > appt.start,
      );

      if (!overlapsBreak && !overlapsAppointment) {
        availableSlots.push({
          startAt: currentSlotStart.toISOString(),
          endAt: currentSlotEnd.toISOString(),
        });
      }

      currentSlotStart = new Date(currentSlotStart.getTime() + intervalMs);
    }

    return availableSlots;
  }

  /**
   * 2. Appointment Creation
   */
  async create(tenantId: string, dto: CreateAppointmentDto, createdByUserId?: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, tenantId },
    });
    if (!service) {
      throw new NotFoundException("Service not found");
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId },
    });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.staffId, tenantId },
    });
    if (!staff) {
      throw new NotFoundException("Staff member not found");
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60000);

    // Conflict check
    await this.verifySlotAvailability(tenantId, dto.staffId, startAt, endAt);

    const appointmentDate = new Date(startAt);
    appointmentDate.setHours(0, 0, 0, 0);

    return this.prisma.appointment.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        staffId: dto.staffId,
        serviceId: dto.serviceId,
        appointmentDate,
        startAt,
        endAt,
        status: AppointmentStatus.CONFIRMED,
        source: dto.source,
        serviceName: service.name,
        durationMinutes: service.durationMinutes,
        price: service.price,
        customerNotes: dto.customerNotes,
        internalNotes: dto.internalNotes,
        createdBy: createdByUserId,
      },
      include: {
        customer: true,
        staff: true,
        service: true,
      },
    });
  }

  /**
   * 3. Reschedule
   */
  async reschedule(
    id: string,
    tenantId: string,
    dto: RescheduleAppointmentDto,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });
    if (!appointment) {
      throw new NotFoundException("Appointment not found");
    }

    const targetStaffId = dto.staffId || appointment.staffId;
    const newStartAt = new Date(dto.startAt);
    const newEndAt = new Date(newStartAt.getTime() + appointment.durationMinutes * 60000);

    await this.verifySlotAvailability(tenantId, targetStaffId, newStartAt, newEndAt, id);

    const appointmentDate = new Date(newStartAt);
    appointmentDate.setHours(0, 0, 0, 0);

    return this.prisma.appointment.update({
      where: { id },
      data: {
        staffId: targetStaffId,
        startAt: newStartAt,
        endAt: newEndAt,
        appointmentDate,
      },
      include: {
        customer: true,
        staff: true,
        service: true,
      },
    });
  }

  /**
   * 4. Cancellation
   */
  async cancel(
    id: string,
    tenantId: string,
    dto: CancelAppointmentDto,
    cancelledByUserId?: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });
    if (!appointment) {
      throw new NotFoundException("Appointment not found");
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancellationReason: dto.cancellationReason,
        cancelledBy: cancelledByUserId,
        cancelledAt: new Date(),
      },
    });
  }

  /**
   * 5. Calendar / Day View
   */
  async getCalendarView(tenantId: string, query: GetCalendarQueryDto) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);

    const whereClause: any = {
      tenantId,
      appointmentDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (query.staffId) {
      whereClause.staffId = query.staffId;
    }

    return this.prisma.appointment.findMany({
      where: whereClause,
      include: {
        customer: true,
        staff: true,
        service: true,
      },
      orderBy: { startAt: "asc" },
    });
  }

  /**
   * 6. Check-in & Status Lifecycle Transitions
   */
  async updateStatus(
    id: string,
    tenantId: string,
    dto: UpdateAppointmentStatusDto,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });
    if (!appointment) {
      throw new NotFoundException("Appointment not found");
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: dto.status,
      },
      include: {
        customer: true,
        staff: true,
        service: true,
      },
    });
  }

  async findOne(id: string, tenantId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        staff: true,
        service: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException("Appointment not found");
    }

    return appointment;
  }

  /**
   * Helper method to verify slot availability
   */
  private async verifySlotAvailability(
    tenantId: string,
    staffId: string,
    startAt: Date,
    endAt: Date,
    excludeAppointmentId?: string,
  ) {
    const dayOfWeek = startAt.getDay();

    // Check staff leave
    const leave = await this.prisma.staffLeave.findFirst({
      where: {
        tenantId,
        staffId,
        startAt: { lte: endAt },
        endAt: { gte: startAt },
      },
    });
    if (leave) {
      throw new ConflictException("Staff is on leave during the requested time");
    }

    // Check weekly schedule
    const schedule = await this.prisma.staffSchedule.findFirst({
      where: { tenantId, staffId, dayOfWeek },
    });
    if (!schedule || !schedule.isWorking) {
      throw new ConflictException("Staff does not work on this day");
    }

    const [startH, startM] = schedule.startTime.split(":").map(Number);
    const [endH, endM] = schedule.endTime.split(":").map(Number);

    const schedStart = new Date(startAt);
    schedStart.setHours(startH, startM, 0, 0);

    const schedEnd = new Date(startAt);
    schedEnd.setHours(endH, endM, 0, 0);

    if (startAt < schedStart || endAt > schedEnd) {
      throw new ConflictException("Selected time is outside staff working hours");
    }

    // Check breaks
    const breaks = await this.prisma.staffBreak.findMany({
      where: { tenantId, staffId, dayOfWeek },
    });
    for (const b of breaks) {
      const [bStartH, bStartM] = b.startTime.split(":").map(Number);
      const [bEndH, bEndM] = b.endTime.split(":").map(Number);

      const bStart = new Date(startAt);
      bStart.setHours(bStartH, bStartM, 0, 0);

      const bEnd = new Date(startAt);
      bEnd.setHours(bEndH, bEndM, 0, 0);

      if (startAt < bEnd && endAt > bStart) {
        throw new ConflictException("Selected time conflicts with a staff break");
      }
    }

    // Check existing appointments
    const conflictingAppointment = await this.prisma.appointment.findFirst({
      where: {
        tenantId,
        staffId,
        id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    if (conflictingAppointment) {
      throw new ConflictException("Selected time slot is already booked for this staff member");
    }
  }
}
