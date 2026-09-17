import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { AttendanceStatus, BreakType } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyAttendance(tenantId: string, dateStr: string) {
    const targetDate = new Date(dateStr);
    targetDate.setUTCHours(0, 0, 0, 0);

    return this.prisma.staffAttendance.findMany({
      where: {
        tenantId,
        date: targetDate,
      },
      include: {
        staff: true,
        breaks: true,
      },
    });
  }

  async clockIn(tenantId: string, staffId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let attendance = await this.prisma.staffAttendance.findUnique({
      where: { tenantId_staffId_date: { tenantId, staffId, date: today } },
    });

    if (attendance?.clockIn) {
      throw new BadRequestException('Already clocked in today');
    }

    if (!attendance) {
      attendance = await this.prisma.staffAttendance.create({
        data: {
          tenantId,
          staffId,
          date: today,
          status: AttendanceStatus.PRESENT,
          clockIn: new Date(),
        },
      });
    } else {
      attendance = await this.prisma.staffAttendance.update({
        where: { id: attendance.id },
        data: { clockIn: new Date(), status: AttendanceStatus.PRESENT },
      });
    }

    return attendance;
  }

  async clockOut(tenantId: string, staffId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const attendance = await this.prisma.staffAttendance.findUnique({
      where: { tenantId_staffId_date: { tenantId, staffId, date: today } },
      include: { breaks: true },
    });

    if (!attendance || !attendance.clockIn) {
      throw new BadRequestException('Not clocked in');
    }

    if (attendance.clockOut) {
      throw new BadRequestException('Already clocked out');
    }

    // Check for open breaks
    const openBreak = attendance.breaks.find((b) => !b.endTime);
    if (openBreak) {
      throw new BadRequestException('Please end your break before clocking out');
    }

    const clockOutTime = new Date();
    const totalHoursMs = clockOutTime.getTime() - attendance.clockIn.getTime();
    const totalHours = totalHoursMs / (1000 * 60 * 60);

    // Calculate total break duration in hours
    const totalBreakMinutes = attendance.breaks.reduce((acc, b) => acc + b.duration, 0);
    const breakHours = totalBreakMinutes / 60;

    // TODO: read from policy to see if breaks are paid. Assume unpaid for now.
    const workingHours = totalHours - breakHours;

    return this.prisma.staffAttendance.update({
      where: { id: attendance.id },
      data: {
        clockOut: clockOutTime,
        totalHours,
        workingHours: Math.max(0, workingHours),
      },
    });
  }

  async startBreak(tenantId: string, staffId: string, type: BreakType) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const attendance = await this.prisma.staffAttendance.findUnique({
      where: { tenantId_staffId_date: { tenantId, staffId, date: today } },
      include: { breaks: true },
    });

    if (!attendance || !attendance.clockIn || attendance.clockOut) {
      throw new BadRequestException('Must be clocked in and not clocked out to take a break');
    }

    const openBreak = attendance.breaks.find((b) => !b.endTime);
    if (openBreak) {
      throw new BadRequestException('Already on a break');
    }

    return this.prisma.staffAttendanceBreak.create({
      data: {
        attendanceId: attendance.id,
        startTime: new Date(),
        type,
      },
    });
  }

  async endBreak(tenantId: string, staffId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const attendance = await this.prisma.staffAttendance.findUnique({
      where: { tenantId_staffId_date: { tenantId, staffId, date: today } },
      include: { breaks: true },
    });

    if (!attendance) {
      throw new BadRequestException('Attendance record not found');
    }

    const openBreak = attendance.breaks.find((b) => !b.endTime);
    if (!openBreak) {
      throw new BadRequestException('Not currently on a break');
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - openBreak.startTime.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));

    return this.prisma.staffAttendanceBreak.update({
      where: { id: openBreak.id },
      data: {
        endTime,
        duration: durationMinutes,
      },
    });
  }
}
