import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/database/prisma.service";
import { SetWeeklyScheduleDto } from "./dto/create-schedule.dto";

@Injectable()
export class StaffScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async setWeeklySchedule(
    staffId: string,
    tenantId: string,
    dto: SetWeeklyScheduleDto,
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId },
    });

    if (!staff) {
      throw new NotFoundException("Staff member not found");
    }

    // Fetch tenant business hours to validate constraints
    const businessHours = await this.prisma.tenantBusinessHour.findMany({
      where: { tenantId },
    });

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (const item of dto.schedules) {
      if (item.isWorking === false) continue;

      if (item.startTime >= item.endTime) {
        throw new BadRequestException(
          `Start time (${item.startTime}) must be strictly before end time (${item.endTime}) on ${dayNames[item.dayOfWeek]}.`,
        );
      }

      const bh = businessHours.find((b) => b.dayOfWeek === item.dayOfWeek);
      if (bh) {
        if (!bh.isOpen) {
          throw new BadRequestException(
            `Store is closed on ${dayNames[item.dayOfWeek]}. Staff cannot be scheduled to work.`,
          );
        }

        if (item.startTime < bh.openTime || item.endTime > bh.closeTime) {
          throw new BadRequestException(
            `Staff working hours on ${dayNames[item.dayOfWeek]} (${item.startTime} - ${item.endTime}) must be within store business hours (${bh.openTime} - ${bh.closeTime}).`,
          );
        }
      }
    }

    // Upsert each day's schedule
    const operations = dto.schedules.map((item) =>
      this.prisma.staffSchedule.upsert({
        where: {
          staffId_dayOfWeek: {
            staffId,
            dayOfWeek: item.dayOfWeek,
          },
        },
        update: {
          startTime: item.startTime,
          endTime: item.endTime,
          isWorking: item.isWorking ?? true,
        },
        create: {
          tenantId,
          staffId,
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
          isWorking: item.isWorking ?? true,
        },
      }),
    );

    return this.prisma.$transaction(operations);
  }

  async getStaffSchedule(staffId: string, tenantId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId },
    });

    if (!staff) {
      throw new NotFoundException("Staff member not found");
    }

    return this.prisma.staffSchedule.findMany({
      where: { staffId, tenantId },
      orderBy: { dayOfWeek: "asc" },
    });
  }
}
