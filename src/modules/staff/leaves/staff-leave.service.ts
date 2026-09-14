import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/database/prisma.service";
import { CreateLeaveDto } from "./dto/create-leave.dto";

@Injectable()
export class StaffLeaveService {
  constructor(private readonly prisma: PrismaService) {}

  async createLeave(staffId: string, tenantId: string, dto: CreateLeaveDto) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId },
    });

    if (!staff) {
      throw new NotFoundException("Staff member not found");
    }

    if (new Date(dto.startAt) >= new Date(dto.endAt)) {
      throw new BadRequestException("startAt must be earlier than endAt");
    }

    return this.prisma.staffLeave.create({
      data: {
        tenantId,
        staffId,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        reason: dto.reason,
      },
    });
  }

  async getLeaves(staffId: string, tenantId: string) {
    return this.prisma.staffLeave.findMany({
      where: { staffId, tenantId },
      orderBy: { startAt: "asc" },
    });
  }

  async deleteLeave(leaveId: string, tenantId: string) {
    const leave = await this.prisma.staffLeave.findFirst({
      where: { id: leaveId, tenantId },
    });

    if (!leave) {
      throw new NotFoundException("Staff leave not found");
    }

    return this.prisma.staffLeave.delete({
      where: { id: leaveId },
    });
  }
}
