import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/database/prisma.service";
import { CreateBreakDto } from "./dto/create-break.dto";

@Injectable()
export class StaffBreakService {
  constructor(private readonly prisma: PrismaService) {}

  async createBreak(staffId: string, tenantId: string, dto: CreateBreakDto) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId },
    });

    if (!staff) {
      throw new NotFoundException("Staff member not found");
    }

    return this.prisma.staffBreak.create({
      data: {
        tenantId,
        staffId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });
  }

  async getBreaks(staffId: string, tenantId: string) {
    return this.prisma.staffBreak.findMany({
      where: { staffId, tenantId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  async deleteBreak(breakId: string, tenantId: string) {
    const breakItem = await this.prisma.staffBreak.findFirst({
      where: { id: breakId, tenantId },
    });

    if (!breakItem) {
      throw new NotFoundException("Staff break not found");
    }

    return this.prisma.staffBreak.delete({
      where: { id: breakId },
    });
  }
}
