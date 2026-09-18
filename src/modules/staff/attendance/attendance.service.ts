import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/database/prisma.service";
import { ClockInDto, ClockOutDto, MarkAbsentDto } from "./dto/attendance.dto";
import { AttendanceStatus } from "@prisma/client";

@Injectable()
export class StaffAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDate(dateStr: string): Date {
    const d = new Date(dateStr);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  async getAttendanceByDate(tenantId: string, dateStr: string) {
    const date = this.parseDate(dateStr);
    
    // Get all staff to ensure we show everyone, even if they haven't clocked in
    const allStaff = await this.prisma.staff.findMany({
      where: { tenantId, status: "ACTIVE" },
      select: { id: true, name: true, profilePicture: true },
    });

    const attendances = await this.prisma.staffAttendance.findMany({
      where: { tenantId, date },
    });

    // Merge staff with attendance
    return allStaff.map((staff) => {
      const attendance = attendances.find((a) => a.staffId === staff.id);
      return {
        staff,
        attendance: attendance || null,
      };
    });
  }

  private async resolveStaffId(staffId: string, tenantId: string): Promise<string> {
    if (staffId.startsWith("EMP-")) {
      const shortId = staffId.replace("EMP-", "").toLowerCase();
      const staff = await this.prisma.staff.findFirst({
        where: {
          tenantId,
          id: { startsWith: shortId },
        },
      });
      if (!staff) {
        throw new NotFoundException("Staff not found for the given Employee ID");
      }
      return staff.id;
    }
    return staffId;
  }

  async clockIn(staffId: string, tenantId: string, dto: ClockInDto) {
    const actualStaffId = await this.resolveStaffId(staffId, tenantId);
    const date = this.parseDate(dto.date);
    const clockInTime = dto.clockInTime ? new Date(dto.clockInTime) : new Date();

    const existing = await this.prisma.staffAttendance.findFirst({
      where: { staffId: actualStaffId, tenantId, date },
    });

    if (existing) {
      if (existing.clockIn) {
        throw new BadRequestException("Staff has already clocked in for this date.");
      }
      return this.prisma.staffAttendance.update({
        where: { id: existing.id },
        data: { clockIn: clockInTime, status: AttendanceStatus.PRESENT },
      });
    }

    return this.prisma.staffAttendance.create({
      data: {
        tenantId,
        staffId: actualStaffId,
        date,
        clockIn: clockInTime,
        status: AttendanceStatus.PRESENT,
      },
    });
  }

  async clockOut(staffId: string, tenantId: string, dto: ClockOutDto) {
    const actualStaffId = await this.resolveStaffId(staffId, tenantId);
    const date = this.parseDate(dto.date);
    const clockOutTime = dto.clockOutTime ? new Date(dto.clockOutTime) : new Date();

    const existing = await this.prisma.staffAttendance.findFirst({
      where: { staffId: actualStaffId, tenantId, date },
    });

    if (!existing || !existing.clockIn) {
      throw new BadRequestException("Staff has not clocked in for this date.");
    }

    if (existing.clockOut) {
      throw new BadRequestException("Staff has already clocked out for this date.");
    }

    // Calculate total hours
    const diffMs = clockOutTime.getTime() - existing.clockIn.getTime();
    const totalHours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;

    return this.prisma.staffAttendance.update({
      where: { id: existing.id },
      data: {
        clockOut: clockOutTime,
        totalHours,
        workingHours: totalHours, // Assuming no breaks recorded in this simple flow yet
      },
    });
  }

  async markAbsent(staffId: string, tenantId: string, dto: MarkAbsentDto) {
    const actualStaffId = await this.resolveStaffId(staffId, tenantId);
    const date = this.parseDate(dto.date);

    const existing = await this.prisma.staffAttendance.findFirst({
      where: { staffId: actualStaffId, tenantId, date },
    });

    if (existing) {
      return this.prisma.staffAttendance.update({
        where: { id: existing.id },
        data: { status: dto.status },
      });
    }

    return this.prisma.staffAttendance.create({
      data: {
        tenantId,
        staffId: actualStaffId,
        date,
        status: dto.status,
      },
    });
  }
}
